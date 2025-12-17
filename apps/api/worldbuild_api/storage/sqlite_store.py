from __future__ import annotations

import json
import sqlite3
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class MatchRecord:
    match_id: str
    created_at: str
    status: str
    seed: int
    tier: int
    challenge: dict[str, Any] | None
    completed_at: str | None
    canon_hash_a: str | None
    canon_hash_b: str | None
    error: str | None


class SQLiteEventStore:
    def __init__(self, db_path: Path):
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(db_path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._lock = threading.Lock()
        self._init_schema()

    def _init_schema(self) -> None:
        with self._conn:
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS matches (
                  match_id TEXT PRIMARY KEY,
                  created_at TEXT NOT NULL,
                  status TEXT NOT NULL,
                  seed INTEGER NOT NULL,
                  tier INTEGER NOT NULL,
                  challenge_json TEXT,
                  completed_at TEXT,
                  canon_hash_a TEXT,
                  canon_hash_b TEXT,
                  error TEXT
                )
                """
            )
            self._conn.execute(
                """
                CREATE TABLE IF NOT EXISTS events (
                  match_id TEXT NOT NULL,
                  seq INTEGER NOT NULL,
                  event_json TEXT NOT NULL,
                  PRIMARY KEY (match_id, seq)
                )
                """
            )
            self._conn.execute("CREATE INDEX IF NOT EXISTS idx_events_match_seq ON events(match_id, seq)")

    def create_match(self, *, match_id: str, created_at: str, seed: int, tier: int) -> None:
        with self._lock, self._conn:
            self._conn.execute(
                """
                INSERT INTO matches(match_id, created_at, status, seed, tier)
                VALUES(?, ?, 'running', ?, ?)
                """,
                (match_id, created_at, seed, tier),
            )

    def set_challenge(self, *, match_id: str, challenge: dict[str, Any]) -> None:
        with self._lock, self._conn:
            self._conn.execute(
                "UPDATE matches SET challenge_json = ? WHERE match_id = ?",
                (json.dumps(challenge, ensure_ascii=False), match_id),
            )

    def mark_completed(
        self, *, match_id: str, completed_at: str, canon_hash_a: str | None, canon_hash_b: str | None
    ) -> None:
        with self._lock, self._conn:
            self._conn.execute(
                """
                UPDATE matches
                SET status = 'completed', completed_at = ?, canon_hash_a = ?, canon_hash_b = ?, error = NULL
                WHERE match_id = ?
                """,
                (completed_at, canon_hash_a, canon_hash_b, match_id),
            )

    def mark_failed(self, *, match_id: str, completed_at: str, error: str) -> None:
        with self._lock, self._conn:
            self._conn.execute(
                """
                UPDATE matches
                SET status = 'failed', completed_at = ?, error = ?
                WHERE match_id = ?
                """,
                (completed_at, error, match_id),
            )

    def append_event(self, *, match_id: str, seq: int, event: dict[str, Any]) -> None:
        with self._lock, self._conn:
            self._conn.execute(
                "INSERT INTO events(match_id, seq, event_json) VALUES(?, ?, ?)",
                (match_id, seq, json.dumps(event, ensure_ascii=False)),
            )

    def list_events(self, *, match_id: str, after_seq: int) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT event_json FROM events WHERE match_id = ? AND seq > ? ORDER BY seq ASC",
                (match_id, after_seq),
            ).fetchall()
        return [json.loads(row["event_json"]) for row in rows]

    def get_match(self, *, match_id: str) -> MatchRecord | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM matches WHERE match_id = ?",
                (match_id,),
            ).fetchone()
        if row is None:
            return None
        return MatchRecord(
            match_id=row["match_id"],
            created_at=row["created_at"],
            status=row["status"],
            seed=int(row["seed"]),
            tier=int(row["tier"]),
            challenge=json.loads(row["challenge_json"]) if row["challenge_json"] else None,
            completed_at=row["completed_at"],
            canon_hash_a=row["canon_hash_a"],
            canon_hash_b=row["canon_hash_b"],
            error=row["error"],
        )

