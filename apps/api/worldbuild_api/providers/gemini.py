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
class GeminiLLMClient:
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
        """Initialize conversation state. Gemini is stateless, so we store context locally."""
        system_instruction = _build_system_instruction(challenge, initial_canon)
        schema = get_contracts().schemas_by_id[TURN_OUTPUT_SCHEMA_ID]

        return ConversationHandle(
            provider="gemini",
            team_id=team_id,
            data={
                "match_seed": match_seed,
                "challenge": challenge,
                "system_instruction": system_instruction,
                "schema": schema,
                "contents": [],  # Conversation history
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
            raise RuntimeError("httpx required for Gemini adapter") from exc

        user_prompt = _build_turn_prompt(context)
        schema = handle.data["schema"]

        # Build contents array with full history
        contents = list(handle.data["contents"])
        contents.append({"role": "user", "parts": [{"text": user_prompt}]})

        # Convert JSON Schema to Gemini's schema format
        gemini_schema = _convert_to_gemini_schema(schema)

        payload: dict[str, Any] = {
            "contents": contents,
            "systemInstruction": {
                "parts": [{"text": handle.data["system_instruction"]}]
            },
            "generationConfig": {
                "temperature": self.config.temperature,
                "maxOutputTokens": self.config.max_output_tokens,
                "responseMimeType": "application/json",
                "responseSchema": gemini_schema,
            },
        }

        model = self.config.model or "gemini-2.0-flash"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={self.api_key}"

        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()

        # Extract text from response
        candidate = data["candidates"][0]
        text_content = candidate["content"]["parts"][0]["text"]
        output: TurnOutput = json.loads(text_content)

        # Update conversation history
        new_contents = list(contents)
        new_contents.append({"role": "model", "parts": [{"text": text_content}]})

        new_handle = ConversationHandle(
            provider="gemini",
            team_id=handle.team_id,
            data={
                **handle.data,
                "contents": new_contents,
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
            raise RuntimeError("httpx required for Gemini adapter") from exc

        schema = get_contracts().schemas_by_id[PROMPT_PACK_SCHEMA_ID]
        gemini_schema = _convert_to_gemini_schema(schema)
        user_prompt = _build_prompt_pack_prompt(canon)

        payload: dict[str, Any] = {
            "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
            "generationConfig": {
                "temperature": self.config.temperature,
                "maxOutputTokens": max(1400, self.config.max_output_tokens),
                "responseMimeType": "application/json",
                "responseSchema": gemini_schema,
            },
        }

        model = self.config.model or "gemini-2.0-flash"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={self.api_key}"

        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()

        candidate = data["candidates"][0]
        text_content = candidate["content"]["parts"][0]["text"]
        return json.loads(text_content)


def _convert_to_gemini_schema(json_schema: dict[str, Any]) -> dict[str, Any]:
    """Convert JSON Schema to Gemini's schema format.

    Gemini uses a subset of JSON Schema with some differences:
    - Uses 'type' with uppercase values (STRING, NUMBER, INTEGER, BOOLEAN, ARRAY, OBJECT)
    - Uses 'items' for array element schema
    - Uses 'properties' for object properties
    - Doesn't support all JSON Schema features
    """
    def convert_type(schema: dict[str, Any]) -> dict[str, Any]:
        if not isinstance(schema, dict):
            return schema

        result: dict[str, Any] = {}

        # Handle type
        json_type = schema.get("type")
        if json_type:
            type_map = {
                "string": "STRING",
                "number": "NUMBER",
                "integer": "INTEGER",
                "boolean": "BOOLEAN",
                "array": "ARRAY",
                "object": "OBJECT",
            }
            result["type"] = type_map.get(json_type, json_type.upper())

        # Handle enum
        if "enum" in schema:
            result["enum"] = schema["enum"]

        # Handle description
        if "description" in schema:
            result["description"] = schema["description"]

        # Handle object properties
        if "properties" in schema:
            result["properties"] = {
                k: convert_type(v) for k, v in schema["properties"].items()
            }

        # Handle required
        if "required" in schema:
            result["required"] = schema["required"]

        # Handle array items
        if "items" in schema:
            result["items"] = convert_type(schema["items"])

        # Handle anyOf/oneOf (convert to first option for simplicity)
        if "anyOf" in schema:
            # Take first non-null option
            for option in schema["anyOf"]:
                if option.get("type") != "null":
                    return convert_type(option)
            return convert_type(schema["anyOf"][0])

        if "oneOf" in schema:
            for option in schema["oneOf"]:
                if option.get("type") != "null":
                    return convert_type(option)
            return convert_type(schema["oneOf"][0])

        # Handle $ref (skip for now, would need schema resolution)
        if "$ref" in schema:
            # Return a generic object type as fallback
            return {"type": "OBJECT"}

        return result

    return convert_type(json_schema)


def _build_system_instruction(challenge: Challenge, initial_canon: dict[str, Any]) -> str:
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
5. Output must be valid JSON matching the required schema.

The deliberation has 4 phases:
- Phase 1 (Foundation): Establish name, governing logic, aesthetic mood
- Phase 2 (Landmarks): Define 3 key landmarks
- Phase 3 (Tension): Inject conflict/stakes
- Phase 4 (Crystallization): Final ratification

You will be told your role and turn type for each turn. Respond with valid JSON."""


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

    prompt += "\n\nGenerate your TurnOutput JSON now."

    return prompt


def _build_prompt_pack_prompt(canon: dict[str, Any]) -> str:
    return f"""You are a neutral Prompt Engineer.

Convert the following final world canon into a PromptPack for image generation.

Rules:
- Do not mention teams, debates, or voting.
- Make prompts richly visual: environment, composition, lighting, materials, mood, and key props.
- Keep the world's governing logic visible in every prompt.
- Provide 6 prompts total:
  - hero_image (16:9 wide establishing shot)
  - landmark_triptych[0..2] (1:1)
  - inhabitant_portrait (3:4)
  - tension_snapshot (16:9)
- Each prompt should stand alone (no external references), and should be safe for general audiences.

FINAL CANON (JSON):
{json.dumps(canon, indent=2)}
"""
