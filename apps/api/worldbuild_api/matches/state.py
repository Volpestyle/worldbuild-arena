from __future__ import annotations

from typing import Any

import jsonpatch

from worldbuild_api.types import TeamId


def derive_team_canon(events: list[dict[str, Any]], *, team_id: TeamId) -> dict[str, Any] | None:
    initial: dict[str, Any] | None = None
    for event in events:
        if event.get("type") != "canon_initialized":
            continue
        if event.get("team_id") != team_id:
            continue
        data = event.get("data") or {}
        canon = data.get("canon")
        if isinstance(canon, dict):
            initial = canon
            break

    if initial is None:
        return None

    canon_state: dict[str, Any] = initial
    for event in events:
        if event.get("type") != "canon_patch_applied":
            continue
        if event.get("team_id") != team_id:
            continue
        patch = (event.get("data") or {}).get("patch")
        if not isinstance(patch, list):
            continue
        canon_state = jsonpatch.JsonPatch(patch).apply(canon_state, in_place=False)

    return canon_state


def derive_team_prompt_pack(events: list[dict[str, Any]], *, team_id: TeamId) -> dict[str, Any] | None:
    prompt_pack: dict[str, Any] | None = None
    for event in events:
        if event.get("type") != "prompt_pack_generated":
            continue
        if event.get("team_id") != team_id:
            continue
        data = event.get("data") or {}
        pack = data.get("prompt_pack")
        if isinstance(pack, dict):
            prompt_pack = pack
    return prompt_pack

