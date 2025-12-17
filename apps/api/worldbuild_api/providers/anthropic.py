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
class AnthropicLLMClient:
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
        """Initialize conversation state. Anthropic is stateless, so we store context locally."""
        system_prompt = _build_system_prompt(challenge, initial_canon)
        schema = get_contracts().schemas_by_id[TURN_OUTPUT_SCHEMA_ID]

        return ConversationHandle(
            provider="anthropic",
            team_id=team_id,
            data={
                "match_seed": match_seed,
                "challenge": challenge,
                "system_prompt": system_prompt,
                "schema": schema,
                "messages": [],  # Conversation history
            },
        )

    async def generate_turn(
        self,
        handle: ConversationHandle,
        context: TurnContext,
    ) -> tuple[TurnOutput, ConversationHandle]:
        try:
            import httpx
        except ImportError as exc:
            raise RuntimeError("httpx required for Anthropic adapter") from exc

        user_prompt = _build_turn_prompt(context)
        schema = handle.data["schema"]

        # Build messages array with full history
        messages = list(handle.data["messages"])
        messages.append({"role": "user", "content": user_prompt})

        # System prompt with cache_control for prompt caching
        system_content = [
            {
                "type": "text",
                "text": handle.data["system_prompt"],
                "cache_control": {"type": "ephemeral"},
            }
        ]

        payload: dict[str, Any] = {
            "model": self.config.model or "claude-sonnet-4-20250514",
            "max_tokens": self.config.max_output_tokens,
            "system": system_content,
            "messages": messages,
            "temperature": self.config.temperature,
        }

        # Request JSON output matching our schema
        # Anthropic uses tool_use for structured output
        payload["tools"] = [
            {
                "name": "submit_turn",
                "description": "Submit your turn output as structured JSON",
                "input_schema": schema,
            }
        ]
        payload["tool_choice"] = {"type": "tool", "name": "submit_turn"}

        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "anthropic-beta": "prompt-caching-2024-07-31",
            "content-type": "application/json",
        }

        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                json=payload,
                headers=headers,
            )
            response.raise_for_status()
            data = response.json()

        # Extract tool use result
        tool_use_block = next(
            (block for block in data["content"] if block["type"] == "tool_use"),
            None,
        )
        if not tool_use_block:
            raise RuntimeError("Anthropic did not return tool_use block")

        output: TurnOutput = tool_use_block["input"]

        # Update conversation history
        new_messages = list(messages)
        # Add assistant response (the tool use)
        new_messages.append({"role": "assistant", "content": data["content"]})
        # Add tool result to continue conversation
        new_messages.append({
            "role": "user",
            "content": [
                {
                    "type": "tool_result",
                    "tool_use_id": tool_use_block["id"],
                    "content": "Turn accepted.",
                }
            ],
        })

        new_handle = ConversationHandle(
            provider="anthropic",
            team_id=handle.team_id,
            data={
                **handle.data,
                "messages": new_messages,
            },
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
            raise RuntimeError("httpx required for Anthropic adapter") from exc

        schema = get_contracts().schemas_by_id[PROMPT_PACK_SCHEMA_ID]
        system_prompt = _build_prompt_engineer_system_prompt()
        user_prompt = _build_prompt_pack_prompt(canon)

        payload: dict[str, Any] = {
            "model": self.config.model or "claude-sonnet-4-20250514",
            "max_tokens": max(1400, self.config.max_output_tokens),
            "system": [
                {
                    "type": "text",
                    "text": system_prompt,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            "messages": [{"role": "user", "content": user_prompt}],
            "temperature": self.config.temperature,
            "tools": [
                {
                    "name": "submit_prompt_pack",
                    "description": "Submit the PromptPack as structured JSON",
                    "input_schema": schema,
                }
            ],
            "tool_choice": {"type": "tool", "name": "submit_prompt_pack"},
            "metadata": {"match_seed": match_seed, "team_id": team_id, "purpose": "prompt_pack"},
        }

        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "anthropic-beta": "prompt-caching-2024-07-31",
            "content-type": "application/json",
        }

        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                json=payload,
                headers=headers,
            )
            response.raise_for_status()
            data = response.json()

        tool_use_block = next(
            (block for block in data["content"] if block["type"] == "tool_use"),
            None,
        )
        if not tool_use_block:
            raise RuntimeError("Anthropic did not return tool_use block")

        return tool_use_block["input"]


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
5. Always use the submit_turn tool to provide your response.

The deliberation has 4 phases:
- Phase 1 (Foundation): Establish name, governing logic, aesthetic mood
- Phase 2 (Landmarks): Define 3 key landmarks
- Phase 3 (Tension): Inject conflict/stakes
- Phase 4 (Crystallization): Final ratification

You will be told your role and turn type for each turn. Use the submit_turn tool to respond."""


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

    prompt += "\n\nUse the submit_turn tool now."

    return prompt


def _build_prompt_engineer_system_prompt() -> str:
    return """You are a neutral Prompt Engineer.

Convert a final world canon/spec into a PromptPack for image generation.

Constraints:
- Do not mention teams, debates, or voting.
- Keep the world’s governing logic visible in every prompt.
- Prompts must be richly visual: environment, composition, lighting, materials, mood.
- Each prompt must stand alone with enough detail for image generation.
- Use the submit_prompt_pack tool to respond."""


def _build_prompt_pack_prompt(canon: dict[str, Any]) -> str:
    return f"""Generate a PromptPack from this final canon (JSON):
{json.dumps(canon, indent=2)}

Aspect ratios:
- hero_image: 16:9
- landmark_triptych: 1:1
- inhabitant_portrait: 3:4
- tension_snapshot: 16:9
"""
