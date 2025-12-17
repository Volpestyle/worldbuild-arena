from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any

from worldbuild_api.contracts.ids import TURN_OUTPUT_SCHEMA_ID
from worldbuild_api.contracts.validate import validate_with_schema
from worldbuild_api.engine.rules import is_role_allowed_for_turn
from worldbuild_api.providers.base import TurnContext
from worldbuild_api.types import TurnOutput


_PLUS_ONE_PATTERN = re.compile(
    r"^\s*(?:\+1\.?|i\s+agree|agree|sounds\s+good|looks\s+good)\s*\.?\s*$",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class TurnValidationResult:
    ok: bool
    errors: list[str]


def validate_turn_output(output: TurnOutput, context: TurnContext) -> TurnValidationResult:
    errors: list[str] = []

    contract = validate_with_schema(TURN_OUTPUT_SCHEMA_ID, output)
    errors.extend(contract.errors)

    if not is_role_allowed_for_turn(context.role, context.turn_type):
        errors.append(f"<root>: role {context.role} not allowed for {context.turn_type}")

    if context.turn_type in ("PROPOSAL", "RESOLUTION") and not output.get("canon_patch"):
        errors.append("<root>: canon_patch required for proposal/resolution")

    if context.turn_type in ("OBJECTION", "RESPONSE") and output.get("canon_patch"):
        errors.append("<root>: canon_patch not allowed for objection/response")

    if context.turn_type == "RESPONSE" and _PLUS_ONE_PATTERN.match(output.get("content", "").strip()):
        errors.append("/content: '+1' style responses are forbidden")

    if context.turn_type == "RESOLUTION":
        refs = output.get("references") or []
        missing = [ref for ref in context.expected_references if ref not in refs]
        if missing:
            errors.append(f"/references: missing required references: {missing}")

    if output.get("canon_patch"):
        errors.extend(_validate_patch_paths(output["canon_patch"], context.allowed_patch_prefixes))

    return TurnValidationResult(ok=not errors, errors=errors)


def _validate_patch_paths(patch: list[dict[str, Any]], allowed_prefixes: list[str]) -> list[str]:
    if not allowed_prefixes:
        return ["<root>: canon_patch not allowed in this phase"]

    errors: list[str] = []
    for index, op in enumerate(patch):
        path = op.get("path")
        if not isinstance(path, str):
            errors.append(f"/canon_patch/{index}: missing 'path'")
            continue
        if not any(path == prefix or path.startswith(prefix + "/") or (prefix == "/" and path.startswith("/")) for prefix in allowed_prefixes):
            errors.append(f"/canon_patch/{index}/path: '{path}' not allowed for this phase")

        from_path = op.get("from")
        if from_path is not None and isinstance(from_path, str):
            if not any(
                from_path == prefix or from_path.startswith(prefix + "/") or (prefix == "/" and from_path.startswith("/"))
                for prefix in allowed_prefixes
            ):
                errors.append(f"/canon_patch/{index}/from: '{from_path}' not allowed for this phase")
    return errors


def normalize_patch_key(patch: list[dict[str, Any]]) -> str:
    return json.dumps(patch, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
