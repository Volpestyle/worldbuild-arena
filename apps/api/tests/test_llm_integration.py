"""LLM provider integration tests.

These tests verify that real LLM providers work correctly with the engine.
They are SKIPPED by default because they:
- Require API keys
- Cost money (real API calls)
- Are slower than mock tests

To run these tests, set the appropriate environment variables:
  - OPENAI_API_KEY for OpenAI tests
  - ANTHROPIC_API_KEY for Anthropic tests
  - GEMINI_API_KEY for Gemini tests

Run with: pytest tests/test_llm_integration.py -v
Or run specific provider: pytest tests/test_llm_integration.py -v -k openai
"""

from __future__ import annotations

import asyncio
import os

import pytest

from worldbuild_api.contracts.ids import PROMPT_PACK_SCHEMA_ID
from worldbuild_api.contracts.validate import validate_with_schema
from worldbuild_api.engine.challenge import generate_challenge
from worldbuild_api.engine.engine import DeliberationEngine, EngineConfig, _initial_canon
from worldbuild_api.engine.events import EngineEvent
from worldbuild_api.engine.validation import validate_turn_output
from worldbuild_api.providers.base import ModelConfig, TurnContext


# Skip markers for each provider
requires_openai = pytest.mark.skipif(
    not os.getenv("OPENAI_API_KEY"),
    reason="OPENAI_API_KEY not set"
)

requires_anthropic = pytest.mark.skipif(
    not os.getenv("ANTHROPIC_API_KEY"),
    reason="ANTHROPIC_API_KEY not set"
)

requires_gemini = pytest.mark.skipif(
    not os.getenv("GEMINI_API_KEY"),
    reason="GEMINI_API_KEY not set"
)


async def _test_single_turn_cycle(provider: str, api_key: str, model: str | None = None) -> None:
    """Test a single turn cycle (PROPOSAL -> OBJECTION -> RESPONSE -> RESOLUTION) with a real provider."""
    if provider == "openai":
        from worldbuild_api.providers.openai import OpenAILLMClient
        llm = OpenAILLMClient(
            api_key=api_key,
            config=ModelConfig(provider="openai", model=model or "gpt-4.1-mini", temperature=0.7),
        )
    elif provider == "anthropic":
        from worldbuild_api.providers.anthropic import AnthropicLLMClient
        llm = AnthropicLLMClient(
            api_key=api_key,
            config=ModelConfig(provider="anthropic", model=model or "claude-sonnet-4-20250514", temperature=0.7),
        )
    elif provider == "gemini":
        from worldbuild_api.providers.gemini import GeminiLLMClient
        llm = GeminiLLMClient(
            api_key=api_key,
            config=ModelConfig(provider="gemini", model=model or "gemini-2.0-flash", temperature=0.7),
        )
    else:
        raise ValueError(f"Unknown provider: {provider}")

    seed = 12345
    tier = 1
    challenge = generate_challenge(seed, tier)
    initial_canon = _initial_canon("A", challenge)

    # Start conversation
    handle = await llm.start_conversation(
        team_id="A",
        match_seed=seed,
        challenge=challenge,
        initial_canon=initial_canon,
    )
    assert handle.provider == provider
    assert handle.team_id == "A"

    # Test PROPOSAL turn
    proposal_context = TurnContext(
        team_id="A",
        role="ARCHITECT",
        turn_type="PROPOSAL",
        phase=1,
        round=1,
        pending_patch=None,
        allowed_patch_prefixes=["/world_name", "/governing_logic", "/aesthetic_mood", "/inhabitants"],
        expected_references=[],
        repair_errors=None,
        attempt=0,
    )
    proposal_output, handle = await llm.generate_turn(handle, proposal_context)

    # Validate output structure
    assert "speaker_role" in proposal_output
    assert proposal_output["speaker_role"] == "ARCHITECT"
    assert "turn_type" in proposal_output
    assert proposal_output["turn_type"] == "PROPOSAL"
    assert "content" in proposal_output
    assert "canon_patch" in proposal_output
    assert isinstance(proposal_output["canon_patch"], list)
    assert len(proposal_output["canon_patch"]) > 0

    # Validate against business rules
    validation = validate_turn_output(proposal_output, proposal_context)
    assert validation.ok, f"Proposal validation failed: {validation.errors}"

    # Test OBJECTION turn
    objection_context = TurnContext(
        team_id="A",
        role="CONTRARIAN",
        turn_type="OBJECTION",
        phase=1,
        round=1,
        pending_patch=None,
        allowed_patch_prefixes=["/world_name", "/governing_logic", "/aesthetic_mood", "/inhabitants"],
        expected_references=["A-1-1-1"],
        repair_errors=None,
        attempt=0,
    )
    objection_output, handle = await llm.generate_turn(handle, objection_context)

    assert objection_output["speaker_role"] == "CONTRARIAN"
    assert objection_output["turn_type"] == "OBJECTION"
    assert "content" in objection_output
    # Objection should NOT have canon_patch
    assert objection_output.get("canon_patch") is None or objection_output.get("canon_patch") == []

    validation = validate_turn_output(objection_output, objection_context)
    assert validation.ok, f"Objection validation failed: {validation.errors}"

    # Test VOTE turn
    vote_context = TurnContext(
        team_id="A",
        role="ARCHITECT",
        turn_type="VOTE",
        phase=1,
        round=1,
        pending_patch=proposal_output.get("canon_patch"),
        allowed_patch_prefixes=["/world_name", "/governing_logic", "/aesthetic_mood", "/inhabitants"],
        expected_references=["A-1-1-4"],
        repair_errors=None,
        attempt=0,
    )
    vote_output, handle = await llm.generate_turn(handle, vote_context)

    assert vote_output["speaker_role"] == "ARCHITECT"
    assert vote_output["turn_type"] == "VOTE"
    assert "vote" in vote_output
    assert vote_output["vote"]["choice"] in ("ACCEPT", "AMEND", "REJECT")


async def _test_prompt_pack_generation(provider: str, api_key: str, model: str | None = None) -> None:
    """Test prompt pack generation with a real provider."""
    if provider == "openai":
        from worldbuild_api.providers.openai import OpenAILLMClient
        llm = OpenAILLMClient(
            api_key=api_key,
            config=ModelConfig(provider="openai", model=model or "gpt-4.1-mini", temperature=0.7),
        )
    elif provider == "anthropic":
        from worldbuild_api.providers.anthropic import AnthropicLLMClient
        llm = AnthropicLLMClient(
            api_key=api_key,
            config=ModelConfig(provider="anthropic", model=model or "claude-sonnet-4-20250514", temperature=0.7),
        )
    elif provider == "gemini":
        from worldbuild_api.providers.gemini import GeminiLLMClient
        llm = GeminiLLMClient(
            api_key=api_key,
            config=ModelConfig(provider="gemini", model=model or "gemini-2.0-flash", temperature=0.7),
        )
    else:
        raise ValueError(f"Unknown provider: {provider}")

    # Use a complete canon for prompt pack generation
    canon = {
        "world_name": "Luminara Spires",
        "governing_logic": "Light is sacred and rationed; every public act consumes measured radiance.",
        "aesthetic_mood": "windswept, luminous, austere, cathedralic",
        "landmarks": [
            {
                "name": "The Prism Sluice",
                "description": "A towering cascade of light-channels carved into volcanic glass.",
                "significance": "Where disputes are settled by ritual measurements of light.",
                "visual_key": "floating lanterns tethered by braided wire",
            },
            {
                "name": "The Ember Archives",
                "description": "Underground vaults storing preserved light in crystal containers.",
                "significance": "Stores the community's most expensive resources.",
                "visual_key": "obsidian tiles that drink reflections",
            },
            {
                "name": "The Dawn Gate",
                "description": "A ceremonial arch that frames the daily light ration distribution.",
                "significance": "Marks the boundary between legal and taboo behavior.",
                "visual_key": "wind-bells made of bone-white glass",
            },
        ],
        "inhabitants": {
            "appearance": "lithe posthuman monks with light-sensitive skin",
            "culture_snapshot": "They trade in measured hours of light and speak in ritual shorthand.",
            "relationship_to_place": "They treat light as a living ledger—every use must be recorded.",
        },
        "tension": {
            "conflict": "A black-market of forbidden light spreads beneath the official rationing.",
            "stakes": "If unresolved, the ration system will collapse into chaos.",
            "visual_manifestation": "public lamps flicker during arguments, casting accusatory shadows",
        },
        "hero_image_description": "A wide shot of Luminara Spires at dusk, with rationed light streaming through prism channels.",
    }

    prompt_pack = await llm.generate_prompt_pack(
        match_seed=12345,
        team_id="A",
        canon=canon,
    )

    # Validate structure
    assert "hero_image" in prompt_pack
    assert "landmark_triptych" in prompt_pack
    assert len(prompt_pack["landmark_triptych"]) == 3
    assert "inhabitant_portrait" in prompt_pack
    assert "tension_snapshot" in prompt_pack

    # Validate against schema
    result = validate_with_schema(PROMPT_PACK_SCHEMA_ID, prompt_pack)
    assert result.ok, f"Prompt pack validation failed: {result.errors}"


# =============================================================================
# OpenAI Tests
# =============================================================================

@requires_openai
def test_openai_single_turn_cycle() -> None:
    """Test OpenAI provider with a single turn cycle."""
    api_key = os.environ["OPENAI_API_KEY"]
    asyncio.run(_test_single_turn_cycle("openai", api_key))


@requires_openai
def test_openai_prompt_pack_generation() -> None:
    """Test OpenAI provider prompt pack generation."""
    api_key = os.environ["OPENAI_API_KEY"]
    asyncio.run(_test_prompt_pack_generation("openai", api_key))


# =============================================================================
# Anthropic Tests
# =============================================================================

@requires_anthropic
def test_anthropic_single_turn_cycle() -> None:
    """Test Anthropic provider with a single turn cycle."""
    api_key = os.environ["ANTHROPIC_API_KEY"]
    asyncio.run(_test_single_turn_cycle("anthropic", api_key))


@requires_anthropic
def test_anthropic_prompt_pack_generation() -> None:
    """Test Anthropic provider prompt pack generation."""
    api_key = os.environ["ANTHROPIC_API_KEY"]
    asyncio.run(_test_prompt_pack_generation("anthropic", api_key))


# =============================================================================
# Gemini Tests
# =============================================================================

@requires_gemini
def test_gemini_single_turn_cycle() -> None:
    """Test Gemini provider with a single turn cycle."""
    api_key = os.environ["GEMINI_API_KEY"]
    asyncio.run(_test_single_turn_cycle("gemini", api_key))


@requires_gemini
def test_gemini_prompt_pack_generation() -> None:
    """Test Gemini provider prompt pack generation."""
    api_key = os.environ["GEMINI_API_KEY"]
    asyncio.run(_test_prompt_pack_generation("gemini", api_key))


# =============================================================================
# Full Match Test (expensive - runs complete deliberation)
# =============================================================================

@requires_openai
@pytest.mark.slow
def test_openai_full_match() -> None:
    """Test a complete match with OpenAI (expensive, ~$0.50-1.00)."""
    async def run() -> None:
        from worldbuild_api.providers.openai import OpenAILLMClient

        api_key = os.environ["OPENAI_API_KEY"]
        llm = OpenAILLMClient(
            api_key=api_key,
            config=ModelConfig(provider="openai", model="gpt-4.1-mini", temperature=0.7),
        )
        engine = DeliberationEngine(llm, config=EngineConfig(max_repair_attempts=2))

        events: list[EngineEvent] = []
        async for event in engine.run_match(seed=42, tier=1):
            events.append(event)
            # Print progress
            if event.type in ("phase_started", "match_completed", "match_failed"):
                print(f"[{event.type}] {event.data}")

        assert events[-1].type == "match_completed", f"Match failed: {events[-1].data}"

    asyncio.run(run())
