from __future__ import annotations

import asyncio
import datetime as dt
import secrets
import uuid
from dataclasses import dataclass
from typing import Any

from worldbuild_api.contracts.ids import MATCH_EVENT_SCHEMA_ID
from worldbuild_api.contracts.validate import validate_with_schema
from worldbuild_api.engine.engine import DeliberationEngine
from worldbuild_api.engine.events import EngineEvent
from worldbuild_api.providers.factory import create_llm_client
from worldbuild_api.storage.sqlite_store import SQLiteEventStore
from worldbuild_api.streaming.hub import MatchHub


def _now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


def _wrap_event(match_id: str, seq: int, engine_event: EngineEvent) -> dict[str, Any]:
    return {
        "id": f"{match_id}:{seq}",
        "seq": seq,
        "ts": _now_iso(),
        "match_id": match_id,
        "team_id": engine_event.team_id,
        "type": engine_event.type,
        "data": engine_event.data,
    }


@dataclass(frozen=True)
class MatchSummary:
    match_id: str
    status: str


class MatchService:
    def __init__(self, *, store: SQLiteEventStore, hub: MatchHub):
        self._store = store
        self._hub = hub
        self._tasks: dict[str, asyncio.Task[None]] = {}

    def create_match(self, *, seed: int | None, tier: int) -> MatchSummary:
        match_id = uuid.uuid4().hex
        match_seed = seed if seed is not None else secrets.randbelow(2**31 - 1)
        self._store.create_match(match_id=match_id, created_at=_now_iso(), seed=match_seed, tier=tier)
        self._tasks[match_id] = asyncio.create_task(self._run_match(match_id=match_id, seed=match_seed, tier=tier))
        return MatchSummary(match_id=match_id, status="running")

    async def _run_match(self, *, match_id: str, seed: int, tier: int) -> None:
        seq = 0
        try:
            llm = create_llm_client()
            engine = DeliberationEngine(llm)
            async for engine_event in engine.run_match(seed=seed, tier=tier):
                seq += 1
                event = _wrap_event(match_id, seq, engine_event)
                validation = validate_with_schema(MATCH_EVENT_SCHEMA_ID, event)
                if not validation.ok:
                    raise RuntimeError(f"MatchEvent schema validation failed: {validation.errors}")

                self._store.append_event(match_id=match_id, seq=seq, event=event)

                if event["type"] == "challenge_revealed":
                    self._store.set_challenge(match_id=match_id, challenge=event["data"])
                if event["type"] == "match_completed":
                    self._store.mark_completed(
                        match_id=match_id,
                        completed_at=event["ts"],
                        canon_hash_a=event["data"].get("canon_hash_a"),
                        canon_hash_b=event["data"].get("canon_hash_b"),
                    )

                await self._hub.publish(match_id, event)
        except Exception as exc:
            seq += 1
            error_message = f"{type(exc).__name__}: {exc}"
            event = {
                "id": f"{match_id}:{seq}",
                "seq": seq,
                "ts": _now_iso(),
                "match_id": match_id,
                "team_id": None,
                "type": "match_failed",
                "data": {"error": error_message},
            }
            self._store.append_event(match_id=match_id, seq=seq, event=event)
            self._store.mark_failed(match_id=match_id, completed_at=event["ts"], error=error_message)
            await self._hub.publish(match_id, event)

