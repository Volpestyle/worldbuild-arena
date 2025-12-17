from __future__ import annotations

from dataclasses import dataclass

from worldbuild_api.providers.base import ModelConfig, TurnContext
from worldbuild_api.types import TurnOutput


@dataclass
class AnthropicLLMClient:
    api_key: str
    config: ModelConfig

    async def generate_turn(self, context: TurnContext) -> TurnOutput:  # pragma: no cover
        raise NotImplementedError(
            "Anthropic adapter not implemented yet. Set LLM_PROVIDER=mock or openai for now."
        )

