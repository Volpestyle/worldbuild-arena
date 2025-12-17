from __future__ import annotations

from worldbuild_api.types import Role


PHASE_ROUNDS: dict[int, int] = {
    0: 0,
    1: 3,
    2: 4,
    3: 2,
    4: 1,
}


def allowed_patch_prefixes_for_phase(phase: int) -> list[str]:
    if phase == 1:
        return ["/world_name", "/governing_logic", "/aesthetic_mood", "/inhabitants"]
    if phase == 2:
        return ["/landmarks"]
    if phase == 3:
        return ["/tension"]
    if phase == 4:
        return ["/"]
    return []


def is_role_allowed_for_turn(role: Role, turn_type: str) -> bool:
    if turn_type == "PROPOSAL":
        return role in ("ARCHITECT", "LOREKEEPER")
    if turn_type == "OBJECTION":
        return role == "CONTRARIAN"
    if turn_type == "RESPONSE":
        return role in ("ARCHITECT", "LOREKEEPER")
    if turn_type == "RESOLUTION":
        return role == "SYNTHESIZER"
    if turn_type == "VOTE":
        return role in ("ARCHITECT", "LOREKEEPER", "CONTRARIAN", "SYNTHESIZER")
    return False

