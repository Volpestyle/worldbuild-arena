import asyncio
import json
from pathlib import Path

import httpx

from worldbuild_api.main import create_app


async def _collect_sse_events(client: httpx.AsyncClient, url: str) -> list[dict]:
    events: list[dict] = []
    async with client.stream("GET", url) as stream:
        stream.raise_for_status()
        async for line in stream.aiter_lines():
            if not line.startswith("data:"):
                continue
            payload = line.removeprefix("data:").strip()
            if not payload:
                continue
            events.append(json.loads(payload))
    return events


async def _run_match_and_collect_events(tmp_path: Path) -> tuple[str, list[dict]]:
    db_path = tmp_path / "test.sqlite3"
    app = create_app(db_path=db_path)

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/matches", json={"seed": 123, "tier": 1})
        response.raise_for_status()
        payload = response.json()
        match_id = payload["match_id"]
        assert payload["status"] == "running"

        events = await _collect_sse_events(client, f"/matches/{match_id}/events?after=0")

        detail = await client.get(f"/matches/{match_id}")
        detail.raise_for_status()
        assert detail.json()["status"] == "completed"
        assert detail.json()["canon_hash_a"]
        assert detail.json()["canon_hash_b"]

        return match_id, events


def test_health_endpoint(tmp_path: Path) -> None:
    async def run() -> None:
        db_path = tmp_path / "health.sqlite3"
        app = create_app(db_path=db_path)
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/health")
            response.raise_for_status()
            assert response.json() == {"ok": True}

    asyncio.run(run())


def test_match_runs_and_streams_events(tmp_path: Path) -> None:
    match_id, events = asyncio.run(_run_match_and_collect_events(tmp_path))

    assert match_id
    assert events, "expected at least one SSE event"
    assert events[0]["type"] == "match_created"
    assert events[-1]["type"] in ("match_completed", "match_failed")

    types = {event["type"] for event in events}
    assert "turn_emitted" in types
    assert "canon_patch_applied" in types

    seqs = [int(event["seq"]) for event in events]
    assert seqs == list(range(1, len(seqs) + 1))
    assert all(event["match_id"] == match_id for event in events)


def test_sse_replay_after_param(tmp_path: Path) -> None:
    async def run() -> None:
        db_path = tmp_path / "replay.sqlite3"
        app = create_app(db_path=db_path)
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post("/matches", json={"seed": 456, "tier": 1})
            response.raise_for_status()
            match_id = response.json()["match_id"]

            all_events = await _collect_sse_events(client, f"/matches/{match_id}/events?after=0")
            assert all_events[-1]["type"] == "match_completed"

            cut_seq = int(all_events[len(all_events) // 2]["seq"])
            replayed = await _collect_sse_events(client, f"/matches/{match_id}/events?after={cut_seq}")

            assert replayed, "expected replay to return events after the cut"
            assert all(int(ev["seq"]) > cut_seq for ev in replayed)
            assert replayed == [ev for ev in all_events if int(ev["seq"]) > cut_seq]

    asyncio.run(run())


def test_match_not_found(tmp_path: Path) -> None:
    async def run() -> None:
        db_path = tmp_path / "missing.sqlite3"
        app = create_app(db_path=db_path)
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/matches/does-not-exist")
            assert response.status_code == 404

            response = await client.get("/matches/does-not-exist/events")
            assert response.status_code == 404

    asyncio.run(run())


def test_create_match_validation_errors(tmp_path: Path) -> None:
    async def run() -> None:
        db_path = tmp_path / "validation.sqlite3"
        app = create_app(db_path=db_path)
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post("/matches", json={"tier": 0})
            assert response.status_code == 422

            response = await client.post("/matches", json={"tier": 4})
            assert response.status_code == 422

    asyncio.run(run())
