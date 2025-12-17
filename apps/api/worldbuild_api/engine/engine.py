from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any, AsyncIterator

import jsonpatch

from worldbuild_api.engine.challenge import generate_challenge
from worldbuild_api.engine.events import EngineEvent
from worldbuild_api.engine.rules import PHASE_ROUNDS, allowed_patch_prefixes_for_phase
from worldbuild_api.engine.validation import normalize_patch_key, validate_turn_output
from worldbuild_api.providers.base import LLMClient, TurnContext
from worldbuild_api.types import Canon, Role, TeamId, TurnOutput, TurnType, VoteChoice
from worldbuild_api.util import sha256_hex


@dataclass(frozen=True)
class EngineConfig:
    max_repair_attempts: int = 2


@dataclass
class TeamState:
    team_id: TeamId
    canon: dict[str, Any]
    next_proposer: Role = "ARCHITECT"
    turn_counter: int = 0


class DeliberationEngine:
    def __init__(self, llm: LLMClient, *, config: EngineConfig | None = None):
        self._llm = llm
        self._config = config or EngineConfig()

    async def run_match(self, *, seed: int, tier: int) -> AsyncIterator[EngineEvent]:
        challenge = generate_challenge(seed, tier)
        yield EngineEvent(type="match_created", team_id=None, data={"seed": seed, "tier": tier})
        yield EngineEvent(type="challenge_revealed", team_id=None, data=challenge)

        team_a = TeamState(team_id="A", canon=_initial_canon("A", challenge))
        team_b = TeamState(team_id="B", canon=_initial_canon("B", challenge))

        for phase in (1, 2, 3, 4):
            round_count = PHASE_ROUNDS[phase]
            yield EngineEvent(type="phase_started", team_id=None, data={"phase": phase, "round_count": round_count})

            for round_number in range(1, round_count + 1):
                for team_state in (team_a, team_b):
                    async for event in self._run_team_round(
                        team_state=team_state,
                        match_seed=seed,
                        phase=phase,
                        round_number=round_number,
                        challenge=challenge,
                    ):
                        yield event

        yield EngineEvent(
            type="match_completed",
            team_id=None,
            data={
                "canon_hash_a": sha256_hex(team_a.canon),
                "canon_hash_b": sha256_hex(team_b.canon),
            },
        )

    async def _run_team_round(
        self,
        *,
        team_state: TeamState,
        match_seed: int,
        phase: int,
        round_number: int,
        challenge: dict[str, Any],
    ) -> AsyncIterator[EngineEvent]:
        if phase == 4:
            async for event in self._run_phase4_crystallization(
                team_state=team_state,
                match_seed=match_seed,
                phase=phase,
                round_number=round_number,
                challenge=challenge,
            ):
                yield event
            return

        proposer = team_state.next_proposer
        responder: Role = "LOREKEEPER" if proposer == "ARCHITECT" else "ARCHITECT"
        team_state.next_proposer = responder

        proposal_turn_id, proposal_output = await self._generate_and_emit_turn(
            team_state=team_state,
            match_seed=match_seed,
            phase=phase,
            round_number=round_number,
            role=proposer,
            turn_type="PROPOSAL",
            challenge=challenge,
            expected_references=[],
            pending_patch=None,
        )
        for event in proposal_output:
            yield event

        objection_turn_id, objection_output = await self._generate_and_emit_turn(
            team_state=team_state,
            match_seed=match_seed,
            phase=phase,
            round_number=round_number,
            role="CONTRARIAN",
            turn_type="OBJECTION",
            challenge=challenge,
            expected_references=[proposal_turn_id],
            pending_patch=None,
        )
        for event in objection_output:
            yield event

        response_turn_id, response_output = await self._generate_and_emit_turn(
            team_state=team_state,
            match_seed=match_seed,
            phase=phase,
            round_number=round_number,
            role=responder,
            turn_type="RESPONSE",
            challenge=challenge,
            expected_references=[proposal_turn_id, objection_turn_id],
            pending_patch=None,
        )
        for event in response_output:
            yield event

        resolution_turn_id, resolution_output = await self._generate_and_emit_turn(
            team_state=team_state,
            match_seed=match_seed,
            phase=phase,
            round_number=round_number,
            role="SYNTHESIZER",
            turn_type="RESOLUTION",
            challenge=challenge,
            expected_references=[proposal_turn_id, objection_turn_id, response_turn_id],
            pending_patch=None,
        )
        for event in resolution_output:
            yield event

        synthesizer_patch = resolution_output[-1].data["output"].get("canon_patch") if resolution_output else None
        votes = []
        for role in ("ARCHITECT", "LOREKEEPER", "CONTRARIAN", "SYNTHESIZER"):
            _, vote_events = await self._generate_and_emit_turn(
                team_state=team_state,
                match_seed=match_seed,
                phase=phase,
                round_number=round_number,
                role=role,  # type: ignore[arg-type]
                turn_type="VOTE",
                challenge=challenge,
                expected_references=[resolution_turn_id],
                pending_patch=synthesizer_patch,
            )
            for event in vote_events:
                yield event
            votes.append(vote_events[-1].data["output"])

        outcome, patch_to_apply = _evaluate_votes(votes, synthesizer_patch)
        yield EngineEvent(
            type="vote_result",
            team_id=team_state.team_id,
            data={
                "phase": phase,
                "round": round_number,
                "result": outcome,
                "tally": _tally_votes(votes),
            },
        )

        if patch_to_apply:
            before_hash = sha256_hex(team_state.canon)
            team_state.canon = jsonpatch.JsonPatch(patch_to_apply).apply(team_state.canon, in_place=False)
            after_hash = sha256_hex(team_state.canon)
            yield EngineEvent(
                type="canon_patch_applied",
                team_id=team_state.team_id,
                data={
                    "phase": phase,
                    "round": round_number,
                    "turn_id": resolution_turn_id,
                    "patch": patch_to_apply,
                    "canon_before_hash": before_hash,
                    "canon_after_hash": after_hash,
                },
            )

    async def _run_phase4_crystallization(
        self,
        *,
        team_state: TeamState,
        match_seed: int,
        phase: int,
        round_number: int,
        challenge: dict[str, Any],
    ) -> AsyncIterator[EngineEvent]:
        resolution_turn_id, resolution_events = await self._generate_and_emit_turn(
            team_state=team_state,
            match_seed=match_seed,
            phase=phase,
            round_number=round_number,
            role="SYNTHESIZER",
            turn_type="RESOLUTION",
            challenge=challenge,
            expected_references=[],
            pending_patch=None,
        )
        for event in resolution_events:
            yield event

        synthesizer_patch = resolution_events[-1].data["output"].get("canon_patch") if resolution_events else None
        votes = []
        for role in ("ARCHITECT", "LOREKEEPER", "CONTRARIAN", "SYNTHESIZER"):
            _, vote_events = await self._generate_and_emit_turn(
                team_state=team_state,
                match_seed=match_seed,
                phase=phase,
                round_number=round_number,
                role=role,  # type: ignore[arg-type]
                turn_type="VOTE",
                challenge=challenge,
                expected_references=[resolution_turn_id],
                pending_patch=synthesizer_patch,
            )
            for event in vote_events:
                yield event
            votes.append(vote_events[-1].data["output"])

        tally = _tally_votes(votes)
        if tally["ACCEPT"] != 4:
            raise RuntimeError(f"Phase 4 requires unanimous ratification; got {tally}")

        if synthesizer_patch:
            before_hash = sha256_hex(team_state.canon)
            team_state.canon = jsonpatch.JsonPatch(synthesizer_patch).apply(team_state.canon, in_place=False)
            after_hash = sha256_hex(team_state.canon)
            yield EngineEvent(
                type="canon_patch_applied",
                team_id=team_state.team_id,
                data={
                    "phase": phase,
                    "round": round_number,
                    "turn_id": resolution_turn_id,
                    "patch": synthesizer_patch,
                    "canon_before_hash": before_hash,
                    "canon_after_hash": after_hash,
                },
            )

        yield EngineEvent(
            type="vote_result",
            team_id=team_state.team_id,
            data={"phase": phase, "round": round_number, "result": "ACCEPT", "tally": tally},
        )

    async def _generate_and_emit_turn(
        self,
        *,
        team_state: TeamState,
        match_seed: int,
        phase: int,
        round_number: int,
        role: Role,
        turn_type: TurnType,
        challenge: dict[str, Any],
        expected_references: list[str],
        pending_patch: list[dict[str, Any]] | None,
    ) -> tuple[str, list[EngineEvent]]:
        allowed_prefixes = allowed_patch_prefixes_for_phase(phase)
        team_state.turn_counter += 1
        turn_id = f"{team_state.team_id}-{phase}-{round_number}-{team_state.turn_counter}"

        events: list[EngineEvent] = []

        attempt = 0
        repair_errors: list[str] | None = None
        while True:
            context = TurnContext(
                match_seed=match_seed,
                team_id=team_state.team_id,
                role=role,
                turn_type=turn_type,
                phase=phase,
                round=round_number,
                challenge=challenge,
                canon=team_state.canon,
                pending_patch=pending_patch,
                allowed_patch_prefixes=allowed_prefixes,
                expected_references=expected_references,
                repair_errors=repair_errors,
                attempt=attempt,
            )
            output = await self._llm.generate_turn(context)
            events.append(
                EngineEvent(
                    type="turn_emitted",
                    team_id=team_state.team_id,
                    data={"phase": phase, "round": round_number, "turn_id": turn_id, "output": output},
                )
            )
            validation = validate_turn_output(output, context)
            if validation.ok:
                return turn_id, events

            events.append(
                EngineEvent(
                    type="turn_validation_failed",
                    team_id=team_state.team_id,
                    data={"phase": phase, "round": round_number, "turn_id": turn_id, "errors": validation.errors},
                )
            )

            if attempt >= self._config.max_repair_attempts:
                raise RuntimeError(f"Turn failed validation after {attempt + 1} attempts: {validation.errors}")

            repair_errors = validation.errors
            attempt += 1
            await asyncio.sleep(0)


def _tally_votes(votes: list[TurnOutput]) -> dict[VoteChoice, int]:
    tally: dict[VoteChoice, int] = {"ACCEPT": 0, "AMEND": 0, "REJECT": 0}
    for vote in votes:
        choice = (vote.get("vote") or {}).get("choice")
        if choice in tally:
            tally[choice] += 1
    return tally


def _evaluate_votes(
    votes: list[TurnOutput],
    synthesizer_patch: list[dict[str, Any]] | None,
) -> tuple[str, list[dict[str, Any]] | None]:
    tally = _tally_votes(votes)

    amendment_groups: dict[str, list[dict[str, Any]]] = {}
    amendment_counts: dict[str, int] = {}
    for vote in votes:
        vote_info = vote.get("vote") or {}
        if vote_info.get("choice") != "AMEND":
            continue
        patch = vote.get("canon_patch")
        if not patch:
            continue
        key = normalize_patch_key(patch)
        amendment_groups[key] = patch
        amendment_counts[key] = amendment_counts.get(key, 0) + 1

    best_amendment = None
    for key, count in amendment_counts.items():
        if count >= 2:
            best_amendment = amendment_groups[key]
            break

    if tally["REJECT"] >= 2:
        return "REJECT", None
    if best_amendment is not None:
        return "AMEND", best_amendment
    if tally["ACCEPT"] >= 3 and synthesizer_patch:
        return "ACCEPT", synthesizer_patch
    if synthesizer_patch:
        return "DEADLOCK", synthesizer_patch
    return "DEADLOCK", None


def _initial_canon(team_id: TeamId, challenge: dict[str, Any]) -> Canon:
    prefix = "Azure" if team_id == "A" else "Cinder"
    return {
        "world_name": f"{prefix} Unnamed",
        "governing_logic": f"(TBD) Twist: {challenge['twist_constraint']}.",
        "aesthetic_mood": "mysterious, unfinished, provisional",
        "landmarks": [
            {
                "name": "TBD Landmark I",
                "description": "Placeholder landmark description.",
                "significance": "Placeholder significance.",
                "visual_key": "Placeholder visual key.",
            },
            {
                "name": "TBD Landmark II",
                "description": "Placeholder landmark description.",
                "significance": "Placeholder significance.",
                "visual_key": "Placeholder visual key.",
            },
            {
                "name": "TBD Landmark III",
                "description": "Placeholder landmark description.",
                "significance": "Placeholder significance.",
                "visual_key": "Placeholder visual key.",
            },
        ],
        "inhabitants": {
            "appearance": f"Placeholder {challenge['inhabitants']}.",
            "culture_snapshot": "Placeholder culture snapshot.",
            "relationship_to_place": "Placeholder relationship to place.",
        },
        "tension": {
            "conflict": "Placeholder conflict.",
            "stakes": "Placeholder stakes.",
            "visual_manifestation": "Placeholder visual manifestation.",
        },
        "hero_image_description": "Placeholder hero image description.",
    }
