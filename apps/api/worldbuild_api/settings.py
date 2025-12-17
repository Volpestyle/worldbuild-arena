from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    db_path: Path


def get_settings() -> Settings:
    default_db_path = Path(__file__).resolve().parents[1] / "data" / "worldbuild.sqlite3"
    db_path = Path(os.getenv("WBA_DB_PATH", str(default_db_path))).expanduser().resolve()
    return Settings(db_path=db_path)

