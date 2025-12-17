from __future__ import annotations

import hashlib
import json
import random
from dataclasses import dataclass
from typing import Any

from worldbuild_api.providers.base import ConversationHandle, ModelConfig, TurnContext
from worldbuild_api.types import Challenge, Role, TeamId, TurnOutput, TurnType, VoteChoice


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

    async def start_conversation(
        self,
        *,
        team_id: TeamId,
        match_seed: int,
        challenge: Challenge,
        initial_canon: dict[str, Any],
    ) -> ConversationHandle:
        """Mock conversation start - just stores metadata for deterministic generation."""
        return ConversationHandle(
            provider="mock",
            team_id=team_id,
            data={
                "match_seed": match_seed,
                "challenge": challenge,
                "initial_canon": initial_canon,
                "turn_count": 0,
            },
        )

    async def generate_turn(
        self,
        handle: ConversationHandle,
        context: TurnContext,
    ) -> tuple[TurnOutput, ConversationHandle]:
        """Generate a deterministic mock turn."""
        match_seed = handle.data["match_seed"]
        challenge = handle.data["challenge"]

        rng = _stable_rng(
            "mock-llm",
            match_seed,
            context.team_id,
            context.phase,
            context.round,
            context.role,
            context.turn_type,
            context.attempt,
        )

        # Create extended context with challenge for turn generation
        extended_context = _ExtendedContext(
            team_id=context.team_id,
            role=context.role,
            turn_type=context.turn_type,
            phase=context.phase,
            round=context.round,
            pending_patch=context.pending_patch,
            allowed_patch_prefixes=context.allowed_patch_prefixes,
            expected_references=context.expected_references,
            challenge=challenge,
        )

        if context.turn_type == "PROPOSAL":
            output = _proposal_turn(rng, extended_context)
        elif context.turn_type == "OBJECTION":
            output = _objection_turn(rng, extended_context)
        elif context.turn_type == "RESPONSE":
            output = _response_turn(rng, extended_context)
        elif context.turn_type == "RESOLUTION":
            output = _resolution_turn(rng, extended_context)
        elif context.turn_type == "VOTE":
            output = _vote_turn(rng, extended_context)
        else:
            raise ValueError(f"Unhandled turn_type: {context.turn_type}")

        # Update handle with incremented turn count
        new_handle = ConversationHandle(
            provider="mock",
            team_id=handle.team_id,
            data={**handle.data, "turn_count": handle.data["turn_count"] + 1},
        )

        return output, new_handle

    async def generate_prompt_pack(
        self,
        *,
        match_seed: int,
        team_id: TeamId,
        canon: dict[str, Any],
    ) -> dict[str, Any]:
        rng = _stable_rng("mock-prompt-pack", match_seed, team_id, canon)

        world_name = str(canon.get("world_name") or _team_prefix(team_id))
        mood = str(canon.get("aesthetic_mood") or "atmospheric, cinematic")
        governing_logic = str(canon.get("governing_logic") or "")

        hero = str(canon.get("hero_image_description") or "")
        landmarks = canon.get("landmarks") or []
        inhabitants = canon.get("inhabitants") or {}
        tension = canon.get("tension") or {}

        style_tag = rng.choice(
            [
                "cinematic concept art, ultra-detailed, volumetric lighting",
                "painterly matte painting, moody atmosphere, high detail",
                "photoreal, wide dynamic range, dramatic lighting",
                "stylized realism, rich texture, soft haze",
            ]
        )

        def prompt_suffix() -> str:
            return f"Style: {style_tag}. Mood: {mood}. Governing logic visible: {governing_logic}"

        hero_prompt = f"{hero}\n{prompt_suffix()}".strip()

        triptych: list[dict[str, Any]] = []
        for idx in range(3):
            lm = landmarks[idx] if idx < len(landmarks) else {}
            name = str(lm.get("name") or f"Landmark {idx + 1}")
            description = str(lm.get("description") or "")
            visual_key = str(lm.get("visual_key") or "")
            significance = str(lm.get("significance") or "")
            triptych.append(
                {
                    "title": f"Landmark — {name}",
                    "prompt": (
                        f"Square composition of {name}. {description} "
                        f"Key visual: {visual_key}. Significance: {significance}. "
                        f"{prompt_suffix()}"
                    ).strip(),
                    "aspect_ratio": "1:1",
                }
            )

        portrait_prompt = (
            f"Portrait of an inhabitant of {world_name} in context. "
            f"Appearance: {inhabitants.get('appearance','')}. "
            f"Culture: {inhabitants.get('culture_snapshot','')}. "
            f"Relationship to place: {inhabitants.get('relationship_to_place','')}. "
            f"{prompt_suffix()}"
        ).strip()

        tension_prompt = (
            f"A narrative moment in {world_name} showing the central tension. "
            f"Conflict: {tension.get('conflict','')}. Stakes: {tension.get('stakes','')}. "
            f"Visible manifestation: {tension.get('visual_manifestation','')}. "
            f"{prompt_suffix()}"
        ).strip()

        return {
            "hero_image": {"title": f"Hero Image — {world_name}", "prompt": hero_prompt, "aspect_ratio": "16:9"},
            "landmark_triptych": triptych,
            "inhabitant_portrait": {
                "title": f"Inhabitant Portrait — {world_name}",
                "prompt": portrait_prompt,
                "aspect_ratio": "3:4",
            },
            "tension_snapshot": {
                "title": f"Tension Snapshot — {world_name}",
                "prompt": tension_prompt,
                "aspect_ratio": "16:9",
            },
        }


@dataclass
class _ExtendedContext:
    """Internal context with challenge info for mock turn generation."""

    team_id: TeamId
    role: Role
    turn_type: TurnType
    phase: int
    round: int
    pending_patch: list[dict[str, Any]] | None
    allowed_patch_prefixes: list[str]
    expected_references: list[str]
    challenge: Challenge


def _proposal_turn(rng: random.Random, context: _ExtendedContext) -> TurnOutput:
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
        # In provider-managed state, mock doesn't have access to current canon
        # Use challenge info to generate a plausible hero description
        team = _team_prefix(context.team_id)
        hero = (
            f"A wide establishing shot of {team} realm in a {context.challenge['biome_setting']}, "
            f"with {context.challenge['inhabitants']} going about their daily rituals. "
            f"The twist constraint '{context.challenge['twist_constraint']}' manifests in the architecture and lighting. "
            "Foreground figures reveal culture through gesture, tools, and dress; the key tension is visible in the scene."
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


def _objection_turn(rng: random.Random, context: _ExtendedContext) -> TurnOutput:
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


def _response_turn(rng: random.Random, context: _ExtendedContext) -> TurnOutput:
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


def _resolution_turn(rng: random.Random, context: _ExtendedContext) -> TurnOutput:
    proposal_context = _ExtendedContext(
        team_id=context.team_id,
        role=context.role,
        turn_type="PROPOSAL",
        phase=context.phase,
        round=context.round,
        pending_patch=context.pending_patch,
        allowed_patch_prefixes=context.allowed_patch_prefixes,
        expected_references=context.expected_references,
        challenge=context.challenge,
    )
    base_patch = _proposal_turn(rng, proposal_context).get("canon_patch", [])
    return {
        "speaker_role": context.role,
        "turn_type": context.turn_type,
        "content": "Resolution: Merge the proposal with the objection’s edge case by adding an enforcement mechanism and a known loophole.",
        "canon_patch": base_patch,
        "references": list(context.expected_references),
    }


def _vote_turn(rng: random.Random, context: _ExtendedContext) -> TurnOutput:
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
