from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from worldbuild_api.contracts.ids import TURN_OUTPUT_SCHEMA_ID
from worldbuild_api.contracts.loader import get_contracts
from worldbuild_api.providers.base import ModelConfig, TurnContext
from worldbuild_api.types import TurnOutput


@dataclass
class OpenAILLMClient:
    api_key: str
    config: ModelConfig

    async def generate_turn(self, context: TurnContext) -> TurnOutput:
        try:
            import httpx
        except ImportError as exc:  # pragma: no cover
            raise RuntimeError("httpx is required for the OpenAI adapter (install `apps/api[dev]`).") from exc

        schema = get_contracts().schemas_by_id[TURN_OUTPUT_SCHEMA_ID]
        payload: dict[str, Any] = {
            "model": self.config.model,
            "temperature": self.config.temperature,
            "max_tokens": self.config.max_output_tokens,
            "messages": [
                {
                    "role": "system",
                    "content": "You are a worldbuilding debate agent. Output must be valid JSON matching the provided JSON Schema.",
                },
                {"role": "user", "content": _build_user_prompt(context)},
            ],
            "response_format": {
                "type": "json_schema",
                "json_schema": {"name": "TurnOutput", "schema": schema, "strict": True},
            },
        }

        headers = {"authorization": f"Bearer {self.api_key}"}
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post("https://api.openai.com/v1/chat/completions", json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()

        content = data["choices"][0]["message"]["content"]
        return json.loads(content)


def _build_user_prompt(context: TurnContext) -> str:
    base = {
        "role": context.role,
        "turn_type": context.turn_type,
        "phase": context.phase,
        "round": context.round,
        "team_id": context.team_id,
        "challenge": context.challenge,
        "canon": context.canon,
        "allowed_patch_prefixes": context.allowed_patch_prefixes,
        "expected_references": context.expected_references,
    }
    if context.repair_errors:
        base["repair_errors"] = context.repair_errors
        base["attempt"] = context.attempt

    return (
        "Generate a TurnOutput object.\n"
        "- Follow the discourse role mandate.\n"
        "- Only write canon_patch operations within allowed_patch_prefixes.\n"
        "- If repairing, fix the listed repair_errors.\n\n"
        f"Context:\n{json.dumps(base, ensure_ascii=False, indent=2)}\n"
    )

