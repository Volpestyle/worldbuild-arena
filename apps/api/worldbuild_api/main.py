from __future__ import annotations

import asyncio
import datetime as dt
import json
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from starlette.responses import StreamingResponse

from worldbuild_api.matches.state import derive_team_canon, derive_team_prompt_pack
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


class TeamArtifactsResponse(BaseModel):
    canon: dict[str, Any] | None
    prompt_pack: dict[str, Any] | None


class ArtifactsResponse(BaseModel):
    match_id: str
    team_a: TeamArtifactsResponse
    team_b: TeamArtifactsResponse


class BlindJudgingEntry(BaseModel):
    blind_id: str
    canon: dict[str, Any]
    prompt_pack: dict[str, Any] | None


class BlindJudgingPackageResponse(BaseModel):
    match_id: str
    entries: list[BlindJudgingEntry]


class JudgingScores(BaseModel):
    internal_coherence: int = Field(ge=1, le=5)
    creative_ambition: int = Field(ge=1, le=5)
    visual_fidelity: int = Field(ge=1, le=5)
    artifact_quality: int = Field(ge=1, le=5)
    process_quality: int = Field(ge=1, le=5)


class SubmitJudgingScoreRequest(BaseModel):
    judge: str = Field(min_length=1)
    blind_id: str = Field(min_length=1)
    scores: JudgingScores
    notes: str | None = None


class JudgingScoreRecord(BaseModel):
    id: int
    created_at: str
    judge: str
    blind_id: str
    scores: JudgingScores
    notes: str | None


class ListJudgingScoresResponse(BaseModel):
    match_id: str
    scores: list[JudgingScoreRecord]


def _format_sse(event: dict[str, Any]) -> str:
    return f"id: {event['seq']}\ndata: {json.dumps(event, ensure_ascii=False)}\n\n"


def _blind_pair_order_key(match_id: str) -> int:
    return int.from_bytes(match_id.encode("utf-8"), "little", signed=False) % 2


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

    @app.get("/matches/{match_id}/artifacts", response_model=ArtifactsResponse)
    async def get_match_artifacts(match_id: str, request_obj: Request) -> ArtifactsResponse:
        store_obj: SQLiteEventStore = request_obj.app.state.store

        record = store_obj.get_match(match_id=match_id)
        if record is None:
            raise HTTPException(status_code=404, detail="match not found")
        if record.status not in ("completed", "failed"):
            raise HTTPException(status_code=409, detail="match not complete")

        events = store_obj.list_events(match_id=match_id, after_seq=0)
        return ArtifactsResponse(
            match_id=match_id,
            team_a=TeamArtifactsResponse(
                canon=derive_team_canon(events, team_id="A"),
                prompt_pack=derive_team_prompt_pack(events, team_id="A"),
            ),
            team_b=TeamArtifactsResponse(
                canon=derive_team_canon(events, team_id="B"),
                prompt_pack=derive_team_prompt_pack(events, team_id="B"),
            ),
        )

    @app.get("/matches/{match_id}/judging/blind", response_model=BlindJudgingPackageResponse)
    async def get_blind_judging_package(match_id: str, request_obj: Request) -> BlindJudgingPackageResponse:
        store_obj: SQLiteEventStore = request_obj.app.state.store

        record = store_obj.get_match(match_id=match_id)
        if record is None:
            raise HTTPException(status_code=404, detail="match not found")
        if record.status != "completed":
            raise HTTPException(status_code=409, detail="match not complete")

        events = store_obj.list_events(match_id=match_id, after_seq=0)
        team_a_canon = derive_team_canon(events, team_id="A")
        team_b_canon = derive_team_canon(events, team_id="B")
        if team_a_canon is None or team_b_canon is None:
            raise HTTPException(status_code=500, detail="missing canon_initialized events")

        team_a_pack = derive_team_prompt_pack(events, team_id="A")
        team_b_pack = derive_team_prompt_pack(events, team_id="B")

        order_key = _blind_pair_order_key(match_id)
        entries = [
            BlindJudgingEntry(blind_id="WORLD-1", canon=team_a_canon, prompt_pack=team_a_pack),
            BlindJudgingEntry(blind_id="WORLD-2", canon=team_b_canon, prompt_pack=team_b_pack),
        ]
        if order_key == 1:
            entries.reverse()
        return BlindJudgingPackageResponse(match_id=match_id, entries=entries)

    @app.get("/matches/{match_id}/judging/reveal")
    async def reveal_blind_mapping(match_id: str, request_obj: Request) -> dict[str, str]:
        store_obj: SQLiteEventStore = request_obj.app.state.store
        record = store_obj.get_match(match_id=match_id)
        if record is None:
            raise HTTPException(status_code=404, detail="match not found")
        if record.status != "completed":
            raise HTTPException(status_code=409, detail="match not complete")

        order_key = _blind_pair_order_key(match_id)
        mapping = {"WORLD-1": "A", "WORLD-2": "B"}
        if order_key == 1:
            mapping = {"WORLD-1": "B", "WORLD-2": "A"}
        return mapping

    @app.post("/matches/{match_id}/judging/scores", response_model=JudgingScoreRecord)
    async def submit_judging_score(
        match_id: str,
        request: SubmitJudgingScoreRequest,
        request_obj: Request,
    ) -> JudgingScoreRecord:
        store_obj: SQLiteEventStore = request_obj.app.state.store

        record = store_obj.get_match(match_id=match_id)
        if record is None:
            raise HTTPException(status_code=404, detail="match not found")
        if record.status != "completed":
            raise HTTPException(status_code=409, detail="match not complete")

        created_at = dt.datetime.now(dt.timezone.utc).isoformat()
        row_id = store_obj.add_judging_score(
            match_id=match_id,
            created_at=created_at,
            judge=request.judge,
            blind_id=request.blind_id,
            scores=request.scores.model_dump(),
            notes=request.notes,
        )
        return JudgingScoreRecord(
            id=row_id,
            created_at=created_at,
            judge=request.judge,
            blind_id=request.blind_id,
            scores=request.scores,
            notes=request.notes,
        )

    @app.get("/matches/{match_id}/judging/scores", response_model=ListJudgingScoresResponse)
    async def list_judging_scores(match_id: str, request_obj: Request) -> ListJudgingScoresResponse:
        store_obj: SQLiteEventStore = request_obj.app.state.store

        record = store_obj.get_match(match_id=match_id)
        if record is None:
            raise HTTPException(status_code=404, detail="match not found")

        rows = store_obj.list_judging_scores(match_id=match_id)
        return ListJudgingScoresResponse(
            match_id=match_id,
            scores=[
                JudgingScoreRecord(
                    id=row["id"],
                    created_at=row["created_at"],
                    judge=row["judge"],
                    blind_id=row["blind_id"],
                    scores=JudgingScores(**row["scores"]),
                    notes=row["notes"],
                )
                for row in rows
            ],
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
