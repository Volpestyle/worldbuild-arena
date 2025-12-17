from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any


@dataclass
class _Subscriber:
    queue: asyncio.Queue[dict[str, Any]]


class MatchHub:
    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._subscribers: dict[str, list[_Subscriber]] = {}

    async def subscribe(self, match_id: str) -> asyncio.Queue[dict[str, Any]]:
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=256)
        async with self._lock:
            self._subscribers.setdefault(match_id, []).append(_Subscriber(queue=queue))
        return queue

    async def unsubscribe(self, match_id: str, queue: asyncio.Queue[dict[str, Any]]) -> None:
        async with self._lock:
            subscribers = self._subscribers.get(match_id)
            if not subscribers:
                return
            self._subscribers[match_id] = [s for s in subscribers if s.queue is not queue]
            if not self._subscribers[match_id]:
                self._subscribers.pop(match_id, None)

    async def publish(self, match_id: str, event: dict[str, Any]) -> None:
        async with self._lock:
            subscribers = list(self._subscribers.get(match_id, []))

        for subscriber in subscribers:
            try:
                subscriber.queue.put_nowait(event)
            except asyncio.QueueFull:
                await self.unsubscribe(match_id, subscriber.queue)

