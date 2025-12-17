from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol

from worldbuild_api.types import Challenge, Role, TeamId, TurnType, TurnOutput


@dataclass(frozen=True)
class ModelConfig:
    provider: str
    model: str | None = None
    temperature: float = 0.7
    max_output_tokens: int = 900


@dataclass
class ConversationHandle:
    """Opaque handle to a provider-managed conversation.

    The engine passes this between calls but never inspects it.
    Each provider stores whatever state it needs (e.g., response_id for OpenAI).
    """

    provider: str
    team_id: TeamId
    data: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class TurnContext:
    """Minimal per-turn context. Provider manages conversation history."""

    team_id: TeamId
    role: Role
    turn_type: TurnType
    phase: int
    round: int
    pending_patch: list[dict[str, Any]] | None
    allowed_patch_prefixes: list[str]
    expected_references: list[str]
    repair_errors: list[str] | None = None
    attempt: int = 0


class LLMClient(Protocol):
    async def start_conversation(
        self,
        *,
        team_id: TeamId,
        match_seed: int,
        challenge: Challenge,
        initial_canon: dict[str, Any],
    ) -> ConversationHandle:
        """Initialize a conversation for a team. Called once per team per match."""
        ...

    async def generate_turn(
        self,
        handle: ConversationHandle,
        context: TurnContext,
    ) -> tuple[TurnOutput, ConversationHandle]:
        """Generate a turn within an existing conversation. Returns updated handle."""
        ...

    async def generate_prompt_pack(
        self,
        *,
        match_seed: int,
        team_id: TeamId,
        canon: dict[str, Any],
    ) -> dict[str, Any]:
        """Generate a PromptPack from a final validated canon/spec."""
        ...


class ImageClient(Protocol):
    async def generate_image(self, prompt: str, *, seed: int | None = None) -> bytes: ...
