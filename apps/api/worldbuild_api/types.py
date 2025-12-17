from __future__ import annotations

from typing import Any, Literal, NotRequired, Required, TypedDict

TeamId = Literal["A", "B"]

Role = Literal["ARCHITECT", "LOREKEEPER", "CONTRARIAN", "SYNTHESIZER"]

TurnType = Literal["PROPOSAL", "OBJECTION", "RESPONSE", "RESOLUTION", "VOTE"]

VoteChoice = Literal["ACCEPT", "AMEND", "REJECT"]


class JsonPatchAdd(TypedDict):
    op: Literal["add"]
    path: str
    value: Any


class JsonPatchRemove(TypedDict):
    op: Literal["remove"]
    path: str


class JsonPatchReplace(TypedDict):
    op: Literal["replace"]
    path: str
    value: Any


JsonPatchMove = TypedDict("JsonPatchMove", {"op": Literal["move"], "from": str, "path": str})
JsonPatchCopy = TypedDict("JsonPatchCopy", {"op": Literal["copy"], "from": str, "path": str})


class JsonPatchTest(TypedDict):
    op: Literal["test"]
    path: str
    value: Any


JsonPatchOp = JsonPatchAdd | JsonPatchRemove | JsonPatchReplace | JsonPatchMove | JsonPatchCopy | JsonPatchTest


class TurnVote(TypedDict, total=False):
    choice: Required[VoteChoice]
    amendment_summary: NotRequired[str]


class TurnOutput(TypedDict, total=False):
    speaker_role: Required[Role]
    turn_type: Required[TurnType]
    content: Required[str]
    canon_patch: NotRequired[list[JsonPatchOp]]
    references: NotRequired[list[str]]
    vote: NotRequired[TurnVote]


class Challenge(TypedDict):
    seed: int
    tier: Literal[1, 2, 3]
    biome_setting: str
    inhabitants: str
    twist_constraint: str


class CanonLandmark(TypedDict):
    name: str
    description: str
    significance: str
    visual_key: str


class Canon(TypedDict):
    world_name: str
    governing_logic: str
    aesthetic_mood: str
    landmarks: list[CanonLandmark]
    inhabitants: dict[str, str]
    tension: dict[str, str]
    hero_image_description: str
