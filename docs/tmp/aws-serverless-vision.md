# Worldbuild Arena — “True Serverless” AWS Vision (Draft)

This doc captures the “pay only for use” direction (scale-to-zero) **while keeping live streaming**. It’s intentionally future-facing; the current implementation is optimized for fast iteration and a single long-lived process.

## 1) Why the current architecture doesn’t map to Lambda “as-is”

Today the API is a stateful, long-lived process:

- Match execution happens as an in-process background task (`asyncio.create_task(...)`).
- Live updates are served via **SSE** with an in-memory pub/sub hub (`MatchHub`), which only works within a single process.
- Persistence is a local **SQLite file**.

These choices are great for local/dev and a single instance, but they break the core assumptions of Lambda-style serverless (short-lived, stateless, horizontally scaled).

## 2) Goals / non-goals

### Goals

- **Scale to zero** when nobody is running or watching matches.
- **Live streaming** to clients (push, not polling).
- **Deterministic replay** stays first-class (event log remains the source of truth).
- **Provider-neutral** LLM support stays intact (OpenAI/Anthropic/Gemini adapters).

### Non-goals (initially)

- Perfect “exactly once” delivery to clients (we can do *at-least once* + replay).
- Multi-region active/active.
- Complex auth/tenancy (can be layered later).

## 3) Target architecture (AWS)

High level:

```text
Browser (Web)
  |  HTTP: create match, query status, list events (replay)
  v
API Gateway (HTTP) -> Lambda (API handlers) -----> DynamoDB (matches, events)
                                             \
                                              \-> SQS / Step Functions (match runner trigger)

Browser (Web)
  |  WebSocket: subscribe to match events
  v
API Gateway (WebSocket) -> Lambda (WS handlers) -> DynamoDB (connections)

DynamoDB (events) -- Streams --> Lambda (broadcaster) -- postToConnection --> WebSocket clients

Artifacts (images) -> S3 (bytes) + DynamoDB (metadata/refs)
```

### 3.1 Storage model (DynamoDB-first)

Keep the current event-sourcing shape, just move it to a serverless store:

- `matches` table: `match_id` (PK) + status, seed, tier, timestamps, error, canonical hashes, etc.
- `events` table: `match_id` (PK) + `seq` (SK) + event payload (same schema as today).
- `connections` table: tracks active WebSocket subscribers.
  - Typical pattern: `match_id` (PK) + `connection_id` (SK) with TTL for cleanup.

### 3.2 Live streaming (WebSockets)

Replace SSE with a WebSocket subscription flow:

- Client connects to WebSocket.
- Client sends `{"action":"subscribe","match_id":"...","after_seq":0}`.
- Server records the `connection_id` ↔ `match_id` mapping.
- Client replays missing events via HTTP (`after_seq`) or via an initial replay message over WebSocket.
- New events are pushed as they are appended.

Delivery is “best effort”:

- If a client misses messages (disconnect), it reconnects and replays from `after_seq`.
- If `postToConnection` returns a “gone” error, delete the connection mapping.

### 3.3 Match execution (externalized runner)

We need to move match execution out of the API process so it can survive cold starts and scale independently.

Two viable patterns:

**Option A (fully serverless): Step Functions + Lambda (turn-by-turn)**

- A state machine advances the match in small steps:
  - load match state
  - generate/validate one turn (or one “round step”)
  - append event
  - persist updated team state (canon + conversation handles + progress cursor)
  - loop / terminate
- Pros: long-running orchestration, retries, durable progress, scale-to-zero.
- Cons: more glue, more state transitions (small added cost), requires explicit persisted state between steps.

**Option B (low-effort migration): SQS + on-demand ECS Fargate worker (per match)**

- HTTP handler enqueues “run match” message (or starts a task).
- A short-lived worker container runs the existing match loop and appends events to DynamoDB.
- Pros: reuses current Python orchestration with minimal refactor; no 15-minute Lambda cap.
- Cons: not as “pure” serverless as Option A; still pay-per-use (tasks only run while a match runs).

### 3.4 Persisting provider conversation state

Serverless execution requires persisting what is currently in-memory:

- `ConversationHandle` per team must be stored after each turn.
  - OpenAI: `response_id` chaining is small and cheap to store.
  - Anthropic/Gemini: conversation history is app-managed, so the handle may grow; plan for chunking or storing larger blobs in S3 with pointers in DynamoDB.

Similarly, we should persist per-team progress (phase, round, proposer rotation) so work can resume deterministically after retries.

## 4) Cost notes (what is actually expensive)

- **LLM + image generation** will dominate costs.
- AWS “true serverless” infra can be close to zero when idle, but it’s not literally free:
  - WebSockets charge per **connection-minute** and messages.
  - DynamoDB charges per read/write.
  - Step Functions charges per state transition (if used).

At very low traffic, these are typically small compared to model calls.

## 5) Migration path (incremental, low-risk)

This is a “don’t rewrite everything at once” path.

### Phase 0 — Make seams explicit (code refactor)

- Introduce interfaces for:
  - `EventStore` (matches + events + judging scores)
  - `EventPublisher` (live broadcast)
  - `MatchRunner` (run match in-process vs external worker)
- Keep SQLite + in-memory hub as the default implementations.

### Phase 1 — Add a serverless event store (dual-run capability)

- Implement `DynamoDBEventStore` with the same semantics as SQLite:
  - append event with `(match_id, seq)` uniqueness
  - list events after seq
  - read/update match status + summary fields
- Keep the API behavior the same (still SSE), but read/write to DynamoDB in staging.

### Phase 2 — Add WebSocket streaming (without changing match execution yet)

- Add API Gateway WebSocket + Lambda handlers:
  - connect/disconnect
  - subscribe/unsubscribe
- Add broadcaster Lambda (DynamoDB Streams on `events`) to push new events to subscribers.
- Update the web client to prefer WebSockets, fallback to SSE for local/dev.

### Phase 3 — Externalize match execution (durable, scalable)

Pick one:

- **3A (fast)**: SQS + on-demand Fargate worker per match.
- **3B (pure)**: Step Functions + Lambda turn-by-turn.

Either way:

- API `POST /matches` becomes “enqueue match” instead of “spawn background task”.
- Match runner becomes the only writer of events after initialization (simplifies concurrency).

### Phase 4 — Remove single-instance assumptions

- Drop in-memory hub requirement in production (keep for local).
- Ensure all streaming is driven from persisted events + replay.
- Optional: move from DynamoDB to Postgres if you need richer queries; keep the append-only event log semantics.

## 6) Open questions / decisions

- Do we want WebSockets only, or keep SSE as a compatibility mode?
- How long can a match run, and what retry semantics do we want when an LLM call fails mid-round?
- How big can `ConversationHandle` get for stateless providers, and do we store it in DynamoDB or S3?
- Do we need auth (Cognito) before going public (likely yes for abuse prevention)?

