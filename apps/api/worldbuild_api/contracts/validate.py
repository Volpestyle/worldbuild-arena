from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from jsonschema import ValidationError

from .loader import get_contracts


@dataclass(frozen=True)
class ContractValidationResult:
    ok: bool
    errors: list[str]


def _format_error(error: ValidationError) -> str:
    path = "/" + "/".join(str(part) for part in error.absolute_path) if error.absolute_path else ""
    return f"{path or '<root>'}: {error.message}"


def validate_with_schema(schema_id: str, instance: Any) -> ContractValidationResult:
    contracts = get_contracts()
    validator = contracts.validator(schema_id)
    errors = sorted(validator.iter_errors(instance), key=lambda e: list(e.absolute_path))
    messages = [_format_error(error) for error in errors]
    return ContractValidationResult(ok=not messages, errors=messages)

