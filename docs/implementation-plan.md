# Worldbuild Arena — pnpm Monorepo Implementation Plan

This plan translates `docs/spec.md` (product/game design) and `docs/tech.md` (agent/orchestrator approach) into a concrete **pnpm workspaces monorepo** build sequence, with a **mobile-first** web UI.

## Monorepo shape (pnpm workspaces)

- `pnpm-workspace.yaml` → `apps/*`, `packages/*`
- Suggested layout:
  - `apps/web` — React + TypeScript UI (mobile-first) with `@react-three/fiber` + `framer-motion`
  - `apps/api` — match orchestrator API (Node/TS) + SSE stream
  - `packages/contracts` — shared types + JSON Schemas (`Canon`, `TurnOutput`, `MatchEvent`, `PromptPack`)
  - `packages/engine` — deterministic `DeliberationEngine` FSM + validators + canon store + transcript event log
  - `packages/llm-core` — provider-agnostic `LLMClient` interface + shared request/response types + structured-output helpers
  - `packages/llm-openai` — OpenAI adapter implementing `LLMClient` (optional first implementation)
  - `packages/llm-anthropic` — Anthropic adapter implementing `LLMClient` (optional)
  - `packages/artifacts` — PromptEngineer + image generation + storage interface
  - `packages/image-core` — provider-agnostic `ImageClient` interface (optional; keep in `packages/artifacts` if preferred)
  - `packages/image-openai` — image adapter implementing `ImageClient` (optional)
  - `packages/ui` — shared HUD components + mobile layout primitives (optional)
  - `packages/config` — shared `tsconfig`, `eslint`, `prettier` (or keep these at repo root)

## Milestones (build in vertical slices)

### 1) Repo scaffold

- Root: pin `packageManager`, TS config, lint/format, `turbo.json` (or plain `pnpm -r`)
- Root scripts: `dev`, `build`, `test`, `lint`, `typecheck` + filtered variants (e.g. `pnpm --filter web dev`)

### 2) Contracts first (unblocks everything)

In `packages/contracts` define:

- `Canon` schema (fields from `docs/spec.md` “Final Spec Structure”)
- `TurnOutput` schema (role + `turn_type` + `content` + `canon_patch` + `references` + `vote`)
- `MatchEvent` union for event-sourced UI replay (turn accepted/rejected, canon patch applied, validator error, artifact created, etc.)
- `PromptPack` schema (6 prompts/team per spec)

Implementation notes:

- Runtime validation: `ajv`
- Patch format: RFC-6902 via `fast-json-patch` (or compatible)

### 3) Provider abstraction (LLM + image)

Define provider-neutral interfaces so `packages/engine` and `apps/api` never depend on a single AI vendor.

- `packages/llm-core`:
  - `LLMClient` interface (sync/async) used by the orchestrator to request a strictly-typed `TurnOutput`
  - shared model config types (provider name, model id, temperature, token limits)
  - helpers for “structured outputs” + a standard repair loop contract (retry caps, error shape)
- Provider adapters (examples):
  - `packages/llm-openai` implements `LLMClient`
  - `packages/llm-anthropic` implements `LLMClient`
- Selection mechanism:
  - choose provider/model via env/config (`LLM_PROVIDER`, `LLM_MODEL`, etc.)
  - wire via dependency injection in `apps/api` (not inside `packages/engine`)
- For image generation, mirror the same approach:
  - keep the interface in `packages/image-core` (or within `packages/artifacts`)
  - add `packages/image-*` adapters as needed

### 4) Engine core (pure + deterministic)

In `packages/engine` implement:

- `challengeGenerator(seed, tier)` (Tier 1–3)
- `DeliberationEngine` FSM implementing phases/round schedule from `docs/spec.md`
- Validator rules from `docs/tech.md`:
  - “no +1” enforcement
  - contrarian objection required
  - no consecutive proposals
  - Synthesizer traceability (`references` + amendments tied to referenced items)
  - phase write restrictions on canon paths
- Repair loop API (`validate → repairPrompt → revalidate`, capped retries)
- Transcript as append-only `MatchEvent[]` + `canon_hash` before/after for deterministic replay

### 5) API app (runs matches + streams events)

In `apps/api` (Fastify/Express):

- `POST /matches` (seed/tier/options) → starts match
- `GET /matches/:id/events` (SSE) → streams `MatchEvent`s (also supports replay from an index)
- `GET /matches/:id` (status + summary)
- Optional controls later: pause/resume/step (move to WebSockets only if needed)

Persistence MVP:

- SQLite (file) + tables like `matches`, `events`, `artifacts` (swap to Postgres later)

### 6) Web app (mobile-optimized “living diorama”)

In `apps/web`:

- Event-log state model: UI derives “current view” from `MatchEvent[]` + an event index (enables scrub/replay as in `docs/tech.md`)
- 3D scene MVP: two tables, 4 role avatars each, seat lamps, camera presets; HUD overlays everything
- HUD MVP (mobile-first):
  - Top bar (phase/round/status)
  - Team panels (last turn collapsed by default; expand for full text)
  - Canon panel (diff view)
  - Timeline controls
  - Artifact gallery (reveals as generated)

Mobile specifics:

- Single-column default; swipe between Team A/B; tap-to-expand panels
- Safe-area padding (`viewport-fit=cover`)
- Performance toggles: reduce motion, lower DPR, pause 3D when HUD expanded

### 7) Artifacts + judging

In `packages/artifacts` + `apps/api` endpoints:

- PromptEngineer runs on final validated canon only (fairness)
- Generate/store 6 artifacts/team (or prompts-only MVP)
- Blind packager that strips team labels for judging

In `apps/web`:

- Gallery view
- (Later) judge scoring UI using rubric from `docs/spec.md`

## Recommended MVP cut (fastest end-to-end)

- Run full match orchestration + validation + SSE + UI replay, but stop at “PromptPack generated” (no image generation yet).
- Add image generation + storage once the match loop and mobile UI feel solid.

## Open choices to confirm (affects plan details)

- Backend: Node/TS (fits pnpm monorepo cleanly) vs Python orchestrator (would live alongside, not as a pnpm package)
- Persistence: SQLite first vs Postgres from day 1
- LLM provider(s) + models: pick a default adapter, but keep `LLMClient` provider-neutral
- Image generation provider + storage (local files vs S3-compatible), ideally via an `ImageClient` adapter layer
