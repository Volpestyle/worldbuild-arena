from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator
from referencing import Registry, Resource


def _find_repo_root(start: Path) -> Path:
    for candidate in [start, *start.parents]:
        if (candidate / "pnpm-workspace.yaml").exists():
            return candidate
    raise RuntimeError("Could not locate repo root (pnpm-workspace.yaml not found)")


def _contracts_schema_dir() -> Path:
    repo_root = _find_repo_root(Path(__file__).resolve())
    return repo_root / "packages" / "contracts" / "schemas"


@dataclass(frozen=True)
class Contracts:
    schema_dir: Path
    schemas_by_id: dict[str, dict[str, Any]]
    registry: Registry

    def validator(self, schema_id: str) -> Draft202012Validator:
        schema = self.schemas_by_id[schema_id]
        return Draft202012Validator(schema, registry=self.registry)


def _load_schemas(schema_dir: Path) -> dict[str, dict[str, Any]]:
    schemas: dict[str, dict[str, Any]] = {}
    for path in sorted(schema_dir.glob("*.schema.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        schema_id = data.get("$id")
        if not isinstance(schema_id, str) or not schema_id:
            raise ValueError(f"Schema missing $id: {path}")
        schemas[schema_id] = data
    return schemas


def _build_registry(schemas_by_id: dict[str, dict[str, Any]]) -> Registry:
    registry = Registry()
    for schema_id, schema in schemas_by_id.items():
        registry = registry.with_resource(schema_id, Resource.from_contents(schema))
    return registry


@lru_cache
def get_contracts() -> Contracts:
    schema_dir = _contracts_schema_dir()
    schemas_by_id = _load_schemas(schema_dir)
    registry = _build_registry(schemas_by_id)
    return Contracts(schema_dir=schema_dir, schemas_by_id=schemas_by_id, registry=registry)
