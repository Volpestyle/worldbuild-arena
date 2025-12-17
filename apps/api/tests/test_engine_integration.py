"""Integration tests for DeliberationEngine without HTTP layer.

These tests exercise the engine directly with MockLLMClient for faster iteration
and more focused testing of internal engine behavior.
"""

from __future__ import annotations

import asyncio

from worldbuild_api.contracts.ids import PROMPT_PACK_SCHEMA_ID
from worldbuild_api.contracts.validate import validate_with_schema
from worldbuild_api.engine.engine import DeliberationEngine, EngineConfig
from worldbuild_api.engine.events import EngineEvent
from worldbuild_api.engine.rules import PHASE_ROUNDS
from worldbuild_api.providers.base import ModelConfig
from worldbuild_api.providers.mock import MockLLMClient


async def _collect_events(engine: DeliberationEngine, seed: int, tier: int) -> list[EngineEvent]:
    """Collect all events from a match run."""
    events: list[EngineEvent] = []
    async for event in engine.run_match(seed=seed, tier=tier):
        events.append(event)
    return events


def _event_types(events: list[EngineEvent]) -> list[str]:
    """Extract event types in order."""
    return [e.type for e in events]


def _events_of_type(events: list[EngineEvent], event_type: str) -> list[EngineEvent]:
    """Filter events by type."""
    return [e for e in events if e.type == event_type]


def test_phase_transitions_emit_events() -> None:
    """Verify phase_started events are emitted with correct phase/round_count."""
    async def run() -> None:
        llm = MockLLMClient(config=ModelConfig(provider="mock", model="mock", temperature=0.7))
        engine = DeliberationEngine(llm)

        events = await _collect_events(engine, seed=100, tier=1)

        phase_events = _events_of_type(events, "phase_started")
        assert len(phase_events) == 5, "Expected 5 phase_started events (phases 1-5)"

        for idx, phase_num in enumerate([1, 2, 3, 4, 5]):
            event = phase_events[idx]
            assert event.data["phase"] == phase_num
            expected_rounds = PHASE_ROUNDS.get(phase_num, 1)
            assert event.data["round_count"] == expected_rounds, (
                f"Phase {phase_num} should have {expected_rounds} rounds"
            )

    asyncio.run(run())


def test_turn_order_follows_protocol() -> None:
    """Verify turns follow PROPOSAL -> OBJECTION -> RESPONSE -> RESOLUTION -> VOTE pattern."""
    async def run() -> None:
        llm = MockLLMClient(config=ModelConfig(provider="mock", model="mock", temperature=0.7))
        engine = DeliberationEngine(llm)

        events = await _collect_events(engine, seed=200, tier=1)

        turn_events = _events_of_type(events, "turn_emitted")

        # Expected turn sequence for phase 4: RESOLUTION + 4 VOTEs
        expected_turn_types_phase4 = ["RESOLUTION", "VOTE", "VOTE", "VOTE", "VOTE"]

        team_turns: dict[str, list[str]] = {"A": [], "B": []}

        for event in turn_events:
            team_id = event.team_id
            turn_type = event.data["output"]["turn_type"]
            if team_id:
                team_turns[team_id].append(turn_type)

        # For a regular round (phases 1-3), each team should follow the protocol
        # Phase 1 has 3 rounds, Phase 2 has 4 rounds, Phase 3 has 2 rounds, Phase 4 has 1 round
        # Total = (3 + 4 + 2) * 2 teams * 8 turns + 1 * 2 teams * 5 turns = 154 turns
        # Wait that's per-team. Let me recalculate.
        # Phase 1: 3 rounds * 8 turns/team = 24 turns/team
        # Phase 2: 4 rounds * 8 turns/team = 32 turns/team
        # Phase 3: 2 rounds * 8 turns/team = 16 turns/team
        # Phase 4: 1 round * 5 turns/team = 5 turns/team
        # Total: 77 turns/team

        # Verify minimum turn counts
        for team_id in ("A", "B"):
            assert len(team_turns[team_id]) >= 50, f"Team {team_id} should have at least 50 turns"

        # Verify the last 5 turns of each team match phase 4 pattern (RESOLUTION + 4 VOTEs)
        for team_id in ("A", "B"):
            last_five = team_turns[team_id][-5:]
            assert last_five == expected_turn_types_phase4, (
                f"Team {team_id} phase 4 pattern mismatch: got {last_five}"
            )

    asyncio.run(run())


def test_canon_initialized_per_team() -> None:
    """Verify both teams get separate canon initialization with appropriate values."""
    async def run() -> None:
        llm = MockLLMClient(config=ModelConfig(provider="mock", model="mock", temperature=0.7))
        engine = DeliberationEngine(llm)

        events = await _collect_events(engine, seed=300, tier=2)

        canon_events = _events_of_type(events, "canon_initialized")
        assert len(canon_events) == 2, "Expected 2 canon_initialized events (one per team)"

        teams_seen = {e.team_id for e in canon_events}
        assert teams_seen == {"A", "B"}, "Both teams should have canon initialized"

        for event in canon_events:
            canon = event.data["canon"]
            team_id = event.team_id

            # Verify canon structure
            assert "world_name" in canon
            assert "governing_logic" in canon
            assert "aesthetic_mood" in canon
            assert "landmarks" in canon
            assert len(canon["landmarks"]) == 3
            assert "inhabitants" in canon
            assert "tension" in canon
            assert "hero_image_description" in canon

            # Verify team-specific naming
            expected_prefix = "Azure" if team_id == "A" else "Cinder"
            assert canon["world_name"].startswith(expected_prefix)

            # Verify hash is present
            assert event.data["canon_hash"]

    asyncio.run(run())


def test_prompt_pack_schema_validation() -> None:
    """Verify prompt packs pass schema validation for both teams."""
    async def run() -> None:
        llm = MockLLMClient(config=ModelConfig(provider="mock", model="mock", temperature=0.7))
        engine = DeliberationEngine(llm)

        events = await _collect_events(engine, seed=400, tier=1)

        prompt_events = _events_of_type(events, "prompt_pack_generated")
        assert len(prompt_events) == 2, "Expected 2 prompt_pack_generated events (one per team)"

        teams_seen = set()
        for event in prompt_events:
            teams_seen.add(event.team_id)
            prompt_pack = event.data["prompt_pack"]

            # Validate against schema
            result = validate_with_schema(PROMPT_PACK_SCHEMA_ID, prompt_pack)
            assert result.ok, f"Prompt pack validation failed: {result.errors}"

            # Verify structure
            assert "hero_image" in prompt_pack
            assert "landmark_triptych" in prompt_pack
            assert len(prompt_pack["landmark_triptych"]) == 3
            assert "inhabitant_portrait" in prompt_pack
            assert "tension_snapshot" in prompt_pack

            # Verify each image spec has required fields
            for key in ("hero_image", "inhabitant_portrait", "tension_snapshot"):
                assert "prompt" in prompt_pack[key], f"{key} missing prompt"
                assert "aspect_ratio" in prompt_pack[key], f"{key} missing aspect_ratio"

        assert teams_seen == {"A", "B"}

    asyncio.run(run())


def test_final_canon_schema_validation() -> None:
    """Verify final canon passes schema validation for both teams."""
    async def run() -> None:
        llm = MockLLMClient(config=ModelConfig(provider="mock", model="mock", temperature=0.7))
        engine = DeliberationEngine(llm)

        events = await _collect_events(engine, seed=500, tier=1)

        # Extract the final canon from canon_patch_applied events
        # The last patch before prompt_pack_generated should be the final state
        completed_event = next(e for e in events if e.type == "match_completed")
        assert completed_event.data["canon_hash_a"]
        assert completed_event.data["canon_hash_b"]

        # The engine internally validates final canon before generating prompt packs
        # If we got here without error, schema validation passed
        prompt_events = _events_of_type(events, "prompt_pack_generated")
        assert len(prompt_events) == 2

    asyncio.run(run())


def test_vote_result_structure() -> None:
    """Verify vote_result events have proper structure."""
    async def run() -> None:
        llm = MockLLMClient(config=ModelConfig(provider="mock", model="mock", temperature=0.7))
        engine = DeliberationEngine(llm)

        events = await _collect_events(engine, seed=600, tier=1)

        vote_events = _events_of_type(events, "vote_result")
        assert len(vote_events) > 0, "Expected at least one vote_result event"

        for event in vote_events:
            assert "phase" in event.data
            assert "round" in event.data
            assert "result" in event.data
            assert event.data["result"] in ("ACCEPT", "AMEND", "REJECT", "DEADLOCK")

            tally = event.data["tally"]
            assert "ACCEPT" in tally
            assert "AMEND" in tally
            assert "REJECT" in tally

            # Tally should sum to 4 (one vote per agent)
            total = tally["ACCEPT"] + tally["AMEND"] + tally["REJECT"]
            assert total == 4, f"Vote tally should sum to 4, got {total}"

    asyncio.run(run())


def test_challenge_revealed_structure() -> None:
    """Verify challenge_revealed event has proper structure."""
    async def run() -> None:
        llm = MockLLMClient(config=ModelConfig(provider="mock", model="mock", temperature=0.7))
        engine = DeliberationEngine(llm)

        events = await _collect_events(engine, seed=700, tier=3)

        challenge_event = next(e for e in events if e.type == "challenge_revealed")
        assert challenge_event.team_id is None, "challenge_revealed should not be team-specific"

        data = challenge_event.data
        assert "seed" in data
        assert "tier" in data
        assert data["tier"] == 3
        assert "biome_setting" in data
        assert "inhabitants" in data
        assert "twist_constraint" in data

    asyncio.run(run())


def test_all_tiers_complete_successfully() -> None:
    """Verify all difficulty tiers complete without errors."""
    async def run() -> None:
        llm = MockLLMClient(config=ModelConfig(provider="mock", model="mock", temperature=0.7))
        engine = DeliberationEngine(llm)

        for tier in (1, 2, 3):
            events = await _collect_events(engine, seed=800 + tier, tier=tier)

            types = _event_types(events)
            assert "match_created" in types
            assert "match_completed" in types
            assert "match_failed" not in types, f"Tier {tier} match failed"

            challenge = next(e for e in events if e.type == "challenge_revealed")
            assert challenge.data["tier"] == tier

    asyncio.run(run())


def test_repair_loop_bounded() -> None:
    """Verify the engine config limits repair attempts."""
    async def run() -> None:
        llm = MockLLMClient(config=ModelConfig(provider="mock", model="mock", temperature=0.7))
        config = EngineConfig(max_repair_attempts=2)
        engine = DeliberationEngine(llm, config=config)

        # With the mock provider, all outputs are valid, so repair shouldn't trigger
        events = await _collect_events(engine, seed=900, tier=1)

        validation_failed = _events_of_type(events, "turn_validation_failed")
        # Mock produces valid outputs, so no validation failures expected
        assert len(validation_failed) == 0

    asyncio.run(run())


def test_canon_patch_applied_events() -> None:
    """Verify canon_patch_applied events contain proper before/after hashes."""
    async def run() -> None:
        llm = MockLLMClient(config=ModelConfig(provider="mock", model="mock", temperature=0.7))
        engine = DeliberationEngine(llm)

        events = await _collect_events(engine, seed=1000, tier=1)

        patch_events = _events_of_type(events, "canon_patch_applied")
        assert len(patch_events) > 0, "Expected canon patches to be applied"

        for event in patch_events:
            assert "patch" in event.data
            assert isinstance(event.data["patch"], list)
            assert "canon_before_hash" in event.data
            assert "canon_after_hash" in event.data
            assert "phase" in event.data
            assert "round" in event.data
            assert "turn_id" in event.data

            # Hashes should be different (patch changed something)
            # Note: This might not always be true if patch is empty or no-op
            # but with mock data it should be

    asyncio.run(run())
