from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from starlette.responses import StreamingResponse

from worldbuild_api.matches.service import MatchService
from worldbuild_api.settings import get_settings
from worldbuild_api.storage.sqlite_store import SQLiteEventStore
from worldbuild_api.streaming.hub import MatchHub

class CreateMatchRequest(BaseModel):
    seed: int | None = None
    tier: int = Field(default=1, ge=1, le=3)


class MatchSummaryResponse(BaseModel):
    match_id: str
    status: str


class MatchDetailResponse(BaseModel):
    match_id: str
    status: str
    created_at: str
    seed: int
    tier: int
    challenge: dict[str, Any] | None
    completed_at: str | None
    canon_hash_a: str | None
    canon_hash_b: str | None
    error: str | None


def _format_sse(event: dict[str, Any]) -> str:
    return f"id: {event['seq']}\ndata: {json.dumps(event, ensure_ascii=False)}\n\n"


def create_app(*, db_path: Path | None = None) -> FastAPI:
    app = FastAPI(title="Worldbuild Arena API", version="0.0.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    settings = get_settings()
    effective_db_path = db_path if db_path is not None else settings.db_path

    store = SQLiteEventStore(effective_db_path)
    hub = MatchHub()
    matches = MatchService(store=store, hub=hub)

    app.state.store = store
    app.state.hub = hub
    app.state.matches = matches

    @app.get("/health")
    async def health() -> dict[str, bool]:
        return {"ok": True}

    @app.post("/matches", response_model=MatchSummaryResponse)
    async def create_match(request: CreateMatchRequest, request_obj: Request) -> MatchSummaryResponse:
        match_service: MatchService = request_obj.app.state.matches
        summary = match_service.create_match(seed=request.seed, tier=request.tier)
        return MatchSummaryResponse(match_id=summary.match_id, status=summary.status)

    @app.get("/matches/{match_id}", response_model=MatchDetailResponse)
    async def get_match(match_id: str, request_obj: Request) -> MatchDetailResponse:
        store_obj: SQLiteEventStore = request_obj.app.state.store
        record = store_obj.get_match(match_id=match_id)
        if record is None:
            raise HTTPException(status_code=404, detail="match not found")
        return MatchDetailResponse(
            match_id=record.match_id,
            status=record.status,
            created_at=record.created_at,
            seed=record.seed,
            tier=record.tier,
            challenge=record.challenge,
            completed_at=record.completed_at,
            canon_hash_a=record.canon_hash_a,
            canon_hash_b=record.canon_hash_b,
            error=record.error,
        )

    @app.get("/matches/{match_id}/events")
    async def stream_events(
        match_id: str,
        request_obj: Request,
        after: int = Query(default=0, ge=0),
    ) -> StreamingResponse:
        store_obj: SQLiteEventStore = request_obj.app.state.store
        hub_obj: MatchHub = request_obj.app.state.hub

        record = store_obj.get_match(match_id=match_id)
        if record is None:
            raise HTTPException(status_code=404, detail="match not found")

        queue = await hub_obj.subscribe(match_id)

        async def event_stream():
            last_seq = after
            try:
                for event in store_obj.list_events(match_id=match_id, after_seq=after):
                    last_seq = max(last_seq, int(event["seq"]))
                    yield _format_sse(event)

                record_after_replay = store_obj.get_match(match_id=match_id)
                if record_after_replay and record_after_replay.status in ("completed", "failed"):
                    return

                while True:
                    try:
                        event = await asyncio.wait_for(queue.get(), timeout=15)
                    except TimeoutError:
                        yield ": ping\n\n"
                        continue

                    if int(event.get("seq", 0)) <= last_seq:
                        continue
                    last_seq = int(event["seq"])
                    yield _format_sse(event)
                    if event.get("type") in ("match_completed", "match_failed"):
                        return
            finally:
                await hub_obj.unsubscribe(match_id, queue)

        return StreamingResponse(
            event_stream(),
            media_type="text/event-stream",
            headers={"cache-control": "no-cache", "connection": "keep-alive"},
        )

    return app


app = create_app()
