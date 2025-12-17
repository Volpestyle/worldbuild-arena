from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from worldbuild_api.contracts.ids import PROMPT_PACK_SCHEMA_ID, TURN_OUTPUT_SCHEMA_ID
from worldbuild_api.contracts.loader import get_contracts
from worldbuild_api.providers.base import ConversationHandle, ModelConfig, TurnContext
from worldbuild_api.types import Challenge, TeamId, TurnOutput

ROLE_MANDATES = {
    "ARCHITECT": "Propose structural/physical elements (geography, buildings, infrastructure). Think in systems and spaces.",
    "LOREKEEPER": "Propose history, culture, inhabitants, naming conventions. Think in stories and meaning.",
    "CONTRARIAN": "Challenge every proposal with a specific objection or edge case. Be constructively adversarial.",
    "SYNTHESIZER": "Resolve conflicts, merge ideas, call for votes, manage convergence. Be diplomatic and decisive. You cannot propose new ideas, only merge and refine existing ones.",
}

TURN_TYPE_INSTRUCTIONS = {
    "PROPOSAL": "Make a proposal with a canon_patch. Be specific and actionable.",
    "OBJECTION": "Raise a specific concern or edge case about the current proposal. No vague objections.",
    "RESPONSE": "Respond to the proposal and objection. You must add, modify, or object—no pure agreement.",
    "RESOLUTION": "Synthesize the discussion. Merge ideas, resolve conflicts, prepare for vote. Include references to what you're merging.",
    "VOTE": "Vote ACCEPT, AMEND, or REJECT. If AMEND, include the amendment in canon_patch.",
}


@dataclass
class OpenAILLMClient:
    api_key: str
    config: ModelConfig

    async def start_conversation(
        self,
        *,
        team_id: TeamId,
        match_seed: int,
        challenge: Challenge,
        initial_canon: dict[str, Any],
    ) -> ConversationHandle:
        try:
            import httpx
        except ImportError as exc:
            raise RuntimeError("httpx required for OpenAI adapter") from exc

        system_prompt = _build_system_prompt(challenge, initial_canon)

        payload: dict[str, Any] = {
            "model": self.config.model or "gpt-4.1-mini",
            "input": system_prompt,
            "store": True,
        }

        headers = {"authorization": f"Bearer {self.api_key}"}
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                "https://api.openai.com/v1/responses",
                json=payload,
                headers=headers,
            )
            response.raise_for_status()
            data = response.json()

        return ConversationHandle(
            provider="openai",
            team_id=team_id,
            data={"response_id": data["id"], "match_seed": match_seed},
        )

    async def generate_turn(
        self,
        handle: ConversationHandle,
        context: TurnContext,
    ) -> tuple[TurnOutput, ConversationHandle]:
        try:
            import httpx
        except ImportError as exc:
            raise RuntimeError("httpx required for OpenAI adapter") from exc

        schema = get_contracts().schemas_by_id[TURN_OUTPUT_SCHEMA_ID]
        user_prompt = _build_turn_prompt(context)

        payload: dict[str, Any] = {
            "model": self.config.model or "gpt-4.1-mini",
            "previous_response_id": handle.data["response_id"],
            "input": [{"role": "user", "content": user_prompt}],
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "TurnOutput",
                    "schema": schema,
                    "strict": True,
                }
            },
            "temperature": self.config.temperature,
            "max_output_tokens": self.config.max_output_tokens,
            "store": True,
        }

        headers = {"authorization": f"Bearer {self.api_key}"}
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                "https://api.openai.com/v1/responses",
                json=payload,
                headers=headers,
            )
            response.raise_for_status()
            data = response.json()

        content = data["output"][0]["content"][0]["text"]
        output: TurnOutput = json.loads(content)

        new_handle = ConversationHandle(
            provider="openai",
            team_id=handle.team_id,
            data={**handle.data, "response_id": data["id"]},
        )

        return output, new_handle

    async def generate_prompt_pack(
        self,
        *,
        match_seed: int,
        team_id: TeamId,
        canon: dict[str, Any],
    ) -> dict[str, Any]:
        try:
            import httpx
        except ImportError as exc:
            raise RuntimeError("httpx required for OpenAI adapter") from exc

        schema = get_contracts().schemas_by_id[PROMPT_PACK_SCHEMA_ID]
        user_prompt = _build_prompt_pack_prompt(canon)

        payload: dict[str, Any] = {
            "model": self.config.model or "gpt-4.1-mini",
            "input": [{"role": "user", "content": user_prompt}],
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "PromptPack",
                    "schema": schema,
                    "strict": True,
                }
            },
            "temperature": self.config.temperature,
            "max_output_tokens": max(1200, self.config.max_output_tokens),
            "store": True,
            "metadata": {
                "match_seed": match_seed,
                "team_id": team_id,
                "purpose": "prompt_pack",
            },
        }

        headers = {"authorization": f"Bearer {self.api_key}"}
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                "https://api.openai.com/v1/responses",
                json=payload,
                headers=headers,
            )
            response.raise_for_status()
            data = response.json()

        content = data["output"][0]["content"][0]["text"]
        return json.loads(content)


def _build_system_prompt(challenge: Challenge, initial_canon: dict[str, Any]) -> str:
    return f"""You are a worldbuilding debate agent on a team of 4 agents (Architect, Lorekeeper, Contrarian, Synthesizer).

CHALLENGE:
- Biome/Setting: {challenge['biome_setting']}
- Inhabitants: {challenge['inhabitants']}
- Twist Constraint: {challenge['twist_constraint']}

INITIAL CANON (starting world state):
{json.dumps(initial_canon, indent=2)}

RULES:
1. No pure "+1" responses. You must always add, modify, or object.
2. Contrarian must object to every proposal with a specific concern.
3. Synthesizer cannot propose new ideas, only merge/refine existing ones.
4. All canon changes must be valid JSON Patch operations.
5. Output must be valid JSON matching the TurnOutput schema.

The deliberation has 4 phases:
- Phase 1 (Foundation): Establish name, governing logic, aesthetic mood
- Phase 2 (Landmarks): Define 3 key landmarks
- Phase 3 (Tension): Inject conflict/stakes
- Phase 4 (Crystallization): Final ratification

You will be told your role and turn type for each turn. Respond accordingly."""


def _build_turn_prompt(context: TurnContext) -> str:
    mandate = ROLE_MANDATES[context.role]
    instruction = TURN_TYPE_INSTRUCTIONS[context.turn_type]

    prompt = f"""YOUR ROLE: {context.role}
MANDATE: {mandate}

PHASE: {context.phase}, ROUND: {context.round}
TURN TYPE: {context.turn_type}
INSTRUCTION: {instruction}

ALLOWED PATCH PREFIXES: {json.dumps(context.allowed_patch_prefixes)}"""

    if context.expected_references:
        prompt += f"\nEXPECTED REFERENCES: {json.dumps(context.expected_references)}"

    if context.pending_patch:
        prompt += f"\nPENDING PATCH (for voting): {json.dumps(context.pending_patch)}"

    if context.repair_errors:
        prompt += f"""

REPAIR REQUIRED (attempt {context.attempt + 1}):
Your previous output had validation errors:
{json.dumps(context.repair_errors, indent=2)}

Fix these errors in your next response."""

    prompt += "\n\nGenerate your TurnOutput now."

    return prompt


def _build_prompt_pack_prompt(canon: dict[str, Any]) -> str:
    return f"""You are a neutral Prompt Engineer.

Convert the following final world canon into a PromptPack for image generation.

Rules:
- Do not mention teams, debates, or voting.
- Make prompts richly visual: environment, composition, lighting, materials, mood, and key props.
- Keep the world’s governing logic visible in every prompt.
- Provide 6 prompts total:
  - hero_image (16:9 wide establishing shot)
  - landmark_triptych[0..2] (1:1)
  - inhabitant_portrait (3:4)
  - tension_snapshot (16:9)
- Each prompt should stand alone (no external references), and should be safe for general audiences.

FINAL CANON (JSON):
{json.dumps(canon, indent=2)}
"""
