from __future__ import annotations

import os

from worldbuild_api.providers.base import LLMClient, ModelConfig
from worldbuild_api.providers.mock import MockLLMClient


def create_llm_client(config: ModelConfig | None = None) -> LLMClient:
    provider = (config.provider if config else os.getenv("LLM_PROVIDER", "mock")).lower()
    model = config.model if config else os.getenv("LLM_MODEL")
    temperature = config.temperature if config else float(os.getenv("LLM_TEMPERATURE", "0.7"))
    max_output_tokens = config.max_output_tokens if config else int(os.getenv("LLM_MAX_OUTPUT_TOKENS", "900"))

    if provider == "mock":
        return MockLLMClient(
            ModelConfig(provider="mock", model=model, temperature=temperature, max_output_tokens=max_output_tokens)
        )

    if provider == "openai":
        from worldbuild_api.providers.openai import OpenAILLMClient

        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY is required when LLM_PROVIDER=openai")
        return OpenAILLMClient(
            api_key=api_key,
            config=ModelConfig(
                provider="openai",
                model=model or "gpt-4.1-mini",
                temperature=temperature,
                max_output_tokens=max_output_tokens,
            ),
        )

    if provider == "anthropic":
        raise ValueError("LLM_PROVIDER=anthropic is stubbed for now (adapter not implemented yet).")

    raise ValueError(f"Unsupported LLM provider '{provider}'.")
