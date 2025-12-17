from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from worldbuild_api.types import TeamId


@dataclass(frozen=True)
class EngineEvent:
    type: str
    team_id: TeamId | None
    data: dict[str, Any]

