from __future__ import annotations

import hashlib
import json
import random
from dataclasses import dataclass
from typing import Any

from worldbuild_api.providers.base import ModelConfig, TurnContext
from worldbuild_api.types import Role, TeamId, TurnOutput, TurnType, VoteChoice


def _stable_rng(*parts: Any) -> random.Random:
    seed_material = json.dumps(parts, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    digest = hashlib.sha256(seed_material).digest()
    seed_int = int.from_bytes(digest[:8], "big", signed=False)
    return random.Random(seed_int)


def _adjectives(rng: random.Random) -> str:
    words = [
        "windswept",
        "luminous",
        "austere",
        "verdigris",
        "salt-stung",
        "hushed",
        "cathedralic",
        "labyrinthine",
        "brine-sweet",
        "rusted",
        "glasslike",
        "emberlit",
    ]
    rng.shuffle(words)
    return ", ".join(words[: rng.randint(3, 5)])


def _team_prefix(team_id: TeamId) -> str:
    return "Azure" if team_id == "A" else "Cinder"


def _vote_choice(rng: random.Random, role: Role, phase: int, round_number: int) -> VoteChoice:
    if role == "CONTRARIAN" and (phase, round_number) in {(2, 2), (3, 1)}:
        return "AMEND"
    if role == "LOREKEEPER" and (phase, round_number) in {(2, 2), (3, 1)}:
        return "AMEND"
    return "ACCEPT"


def _amendment_patch(base_patch: list[dict[str, Any]], path: str, suffix: str) -> list[dict[str, Any]]:
    patch = list(base_patch)
    patch.append({"op": "replace", "path": path, "value": suffix})
    return patch


@dataclass
class MockLLMClient:
    config: ModelConfig

    async def generate_turn(self, context: TurnContext) -> TurnOutput:
        rng = _stable_rng(
            "mock-llm",
            context.match_seed,
            context.team_id,
            context.phase,
            context.round,
            context.role,
            context.turn_type,
            context.attempt,
        )

        if context.turn_type == "PROPOSAL":
            return _proposal_turn(rng, context)
        if context.turn_type == "OBJECTION":
            return _objection_turn(rng, context)
        if context.turn_type == "RESPONSE":
            return _response_turn(rng, context)
        if context.turn_type == "RESOLUTION":
            return _resolution_turn(rng, context)
        if context.turn_type == "VOTE":
            return _vote_turn(rng, context)
        raise ValueError(f"Unhandled turn_type: {context.turn_type}")


def _proposal_turn(rng: random.Random, context: TurnContext) -> TurnOutput:
    team = _team_prefix(context.team_id)
    if context.phase == 1:
        world_name = f"{team} {rng.choice(['Bastion', 'Haven', 'Sanctum', 'Spires', 'Archive'])}"
        governing_logic = rng.choice(
            [
                "Light is sacred and rationed; every public act consumes measured radiance.",
                "All structures must be temporary; permanence is treated as a social crime.",
                "Vertical space is status; altitude dictates law, diet, and dialect.",
                "The founders are alive but sleeping; citizens interpret their dreams as edicts.",
            ]
        )
        mood = _adjectives(rng)
        patch: list[dict[str, Any]] = [
            {"op": "replace", "path": "/world_name", "value": world_name},
            {"op": "replace", "path": "/governing_logic", "value": governing_logic},
            {"op": "replace", "path": "/aesthetic_mood", "value": mood},
            {
                "op": "replace",
                "path": "/inhabitants/appearance",
                "value": f"{rng.choice(['lithe', 'scarred', 'mask-wearing', 'ink-stained'])} {context.challenge['inhabitants']}",
            },
            {
                "op": "replace",
                "path": "/inhabitants/culture_snapshot",
                "value": f"They trade in {rng.choice(['songs', 'salt', 'ink', 'hours'])} and speak in ritual shorthand to honor the rule.",
            },
            {
                "op": "replace",
                "path": "/inhabitants/relationship_to_place",
                "value": "They treat the environment as a living ledger—every change must be paid back later.",
            },
        ]
        return {
            "speaker_role": context.role,
            "turn_type": context.turn_type,
            "content": f"Proposal: name the place **{world_name}** and center it on: {governing_logic} Mood: {mood}.",
            "canon_patch": patch,
        }

    if context.phase == 2:
        landmark_index = min(context.round - 1, 2)
        landmark_name = f"{team} {rng.choice(['Steps', 'Furnace', 'Grotto', 'Causeway', 'Aviary'])}"
        patch = [
            {"op": "replace", "path": f"/landmarks/{landmark_index}/name", "value": landmark_name},
            {
                "op": "replace",
                "path": f"/landmarks/{landmark_index}/description",
                "value": f"A {context.challenge['biome_setting']} landmark shaped by the rule: {rng.choice(['echoing', 'knife-edged', 'slowly migrating', 'lantern-lit'])}.",
            },
            {
                "op": "replace",
                "path": f"/landmarks/{landmark_index}/significance",
                "value": rng.choice(
                    [
                        "It is where disputes are settled by ritual measurements.",
                        "It stores the community’s most expensive resources.",
                        "It marks the boundary between legal and taboo behavior.",
                    ]
                ),
            },
            {
                "op": "replace",
                "path": f"/landmarks/{landmark_index}/visual_key",
                "value": rng.choice(
                    [
                        "floating lanterns tethered by braided wire",
                        "obsidian tiles that drink reflections",
                        "wind-bells made of bone-white glass",
                        "a spiral of red moss glowing in the dark",
                    ]
                ),
            },
        ]
        return {
            "speaker_role": context.role,
            "turn_type": context.turn_type,
            "content": f"Proposal: define landmark {landmark_index + 1} as **{landmark_name}** tied to the governing logic.",
            "canon_patch": patch,
        }

    if context.phase == 3:
        patch = [
            {
                "op": "replace",
                "path": "/tension/conflict",
                "value": rng.choice(
                    [
                        "A black-market of forbidden permanence spreads beneath the official rituals.",
                        "The ration of sacred light is shrinking, and no one agrees why.",
                        "Old dream-edicts contradict new survival needs, splitting households.",
                    ]
                ),
            },
            {
                "op": "replace",
                "path": "/tension/stakes",
                "value": "If unresolved, the rule that holds the city together will become a weapon instead of a compass.",
            },
            {
                "op": "replace",
                "path": "/tension/visual_manifestation",
                "value": rng.choice(
                    [
                        "public lamps flicker during arguments, casting long, accusatory shadows",
                        "temporary buildings sag as if exhausted, then are torn down overnight",
                        "secret stairways bloom with illegal carvings that refuse to erode",
                    ]
                ),
            },
        ]
        return {
            "speaker_role": context.role,
            "turn_type": context.turn_type,
            "content": "Proposal: inject a tension that makes the rule unstable in a visible way.",
            "canon_patch": patch,
        }

    if context.phase == 4:
        hero = (
            f"A wide establishing shot of {context.canon.get('world_name')} in a {context.challenge['biome_setting']}, "
            f"showing the governing logic in action: {context.canon.get('governing_logic')} "
            "Foreground figures reveal culture through gesture, tools, and dress; the key tension is visible in the lighting and architecture."
        )
        patch = [{"op": "replace", "path": "/hero_image_description", "value": hero}]
        return {
            "speaker_role": context.role,
            "turn_type": context.turn_type,
            "content": "Proposal: crystallize the final spec with a hero image description that embodies the canon.",
            "canon_patch": patch,
        }

    return {
        "speaker_role": context.role,
        "turn_type": context.turn_type,
        "content": "Proposal: (phase not implemented in mock)",
    }


def _objection_turn(rng: random.Random, context: TurnContext) -> TurnOutput:
    return {
        "speaker_role": context.role,
        "turn_type": context.turn_type,
        "content": rng.choice(
            [
                "Objection: What fails first under stress? If outsiders arrive, how does the rule prevent exploitation instead of enabling it?",
                "Objection: This risks becoming vibes-only. What concrete mechanism enforces the rule day-to-day, and what’s the loophole?",
                "Objection: The proposal creates a neat story, but where does the mess come from—waste, dissent, weather, scarcity?",
            ]
        ),
    }


def _response_turn(rng: random.Random, context: TurnContext) -> TurnOutput:
    return {
        "speaker_role": context.role,
        "turn_type": context.turn_type,
        "content": rng.choice(
            [
                "Response: Add a visible enforcement ritual (tokens, lamps, ledgers) and a quiet workaround that only insiders understand.",
                "Response: Tie the rule to infrastructure—water, light, elevators—so breaking it has immediate material consequences.",
                "Response: Ground it with one concrete example of daily life, plus a contradiction that foreshadows later tension.",
            ]
        ),
    }


def _resolution_turn(rng: random.Random, context: TurnContext) -> TurnOutput:
    base_patch = _proposal_turn(rng, TurnContext(**{**context.__dict__, "turn_type": "PROPOSAL"})).get(
        "canon_patch", []
    )
    return {
        "speaker_role": context.role,
        "turn_type": context.turn_type,
        "content": "Resolution: Merge the proposal with the objection’s edge case by adding an enforcement mechanism and a known loophole.",
        "canon_patch": base_patch,
        "references": list(context.expected_references),
    }


def _vote_turn(rng: random.Random, context: TurnContext) -> TurnOutput:
    choice = _vote_choice(rng, context.role, context.phase, context.round)
    output: TurnOutput = {
        "speaker_role": context.role,
        "turn_type": context.turn_type,
        "content": f"Vote: {choice}",
        "vote": {"choice": choice},
    }
    if choice == "AMEND":
        output["vote"] = {"choice": "AMEND", "amendment_summary": "Sharpen the stakes with a specific visible tell."}
        base_patch = context.pending_patch
        if isinstance(base_patch, list) and base_patch:
            output["canon_patch"] = _amendment_patch(
                base_patch,
                "/tension/visual_manifestation" if context.phase == 3 else "/landmarks/0/visual_key",
                "a pulse of warning light that spreads across surfaces like spilled ink",
            )
    return output
