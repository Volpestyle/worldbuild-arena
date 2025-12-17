from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol

from worldbuild_api.types import Challenge, Role, TeamId, TurnType, TurnOutput


@dataclass(frozen=True)
class ModelConfig:
    provider: str
    model: str | None = None
    temperature: float = 0.7
    max_output_tokens: int = 900


@dataclass(frozen=True)
class TurnContext:
    match_seed: int
    team_id: TeamId
    role: Role
    turn_type: TurnType
    phase: int
    round: int
    challenge: Challenge
    canon: dict[str, Any]
    pending_patch: list[dict[str, Any]] | None
    allowed_patch_prefixes: list[str]
    expected_references: list[str]
    repair_errors: list[str] | None = None
    attempt: int = 0


class LLMClient(Protocol):
    async def generate_turn(self, context: TurnContext) -> TurnOutput: ...


class ImageClient(Protocol):
    async def generate_image(self, prompt: str, *, seed: int | None = None) -> bytes: ...
