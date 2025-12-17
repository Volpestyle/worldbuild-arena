# Worldbuild Arena — Monorepo Implementation Plan (Python backend + schema-first contracts)

This plan translates `docs/spec.md` (product/game design) and `docs/tech.md` (agent/orchestrator approach) into a concrete monorepo build sequence with a **Python orchestrator/API**, **schema-first contracts**, and a **mobile-first** web UI.

## Monorepo shape (pnpm workspaces)

- `pnpm-workspace.yaml` → `apps/web`, `packages/*` (TypeScript-only)
- Suggested layout:
  - `apps/web` — React + TypeScript UI (mobile-first) with `@react-three/fiber` + `framer-motion`
  - `apps/api` — match orchestrator API (**Python**) + SSE stream (Python project; not a pnpm package)
  - `packages/contracts` — **JSON Schemas are the source of truth** + codegen for TS/Python (`Canon`, `TurnOutput`, `MatchEvent`, `PromptPack`)
  - `packages/ui` — shared HUD components + mobile layout primitives (optional)
  - `packages/config` — shared `tsconfig`, `eslint`, `prettier` (or keep these at repo root)

## Milestones (build in vertical slices)

### 1) Repo scaffold

- Root: pin `packageManager`, TS config, lint/format, `turbo.json` (or plain `pnpm -r`) + Python toolchain (`pyproject.toml` in `apps/api`)
- Root scripts: `dev`, `build`, `test` that run both toolchains (e.g. `pnpm --filter web dev` + `(cd apps/api && uvicorn worldbuild_api.main:app --reload)`)

### 2) Contracts first (unblocks everything)

In `packages/contracts` define **JSON Schemas** (single source of truth) for:

- `Canon` schema (fields from `docs/spec.md` “Final Spec Structure”)
- `TurnOutput` schema (role + `turn_type` + `content` + `canon_patch` + `references` + `vote`)
- `MatchEvent` union for event-sourced UI replay (turn accepted/rejected, canon patch applied, validator error, artifact created, etc.)
- `PromptPack` schema (6 prompts/team per spec)

Implementation notes:

- Codegen: generate TS types for `apps/web` and Python models/types for `apps/api` from the same schemas (optional; runtime validation is still schema-driven)
- Runtime validation: Python JSON Schema validator in `apps/api`; `ajv` in `apps/web` (and/or build-time validation in CI)
- Patch format: RFC-6902 JSON Patch (Python implementation on server; client can treat as data or apply for replay/diff)

Schema-first workflow:

- Author schemas in `packages/contracts/schemas/*.schema.json`
- Generate language bindings:
  - TypeScript → `apps/web` (types + optional validators)
  - Python → `apps/api` (Pydantic models/TypedDicts + helpers)
- CI guardrails: schema lint/validation + “generated code is up to date” check

### 3) Provider abstraction (LLM + image)

Define provider-neutral interfaces so `apps/api` never depends on a single AI vendor.

- `apps/api`:
  - `LLMClient` interface used by the orchestrator to request a strictly-typed `TurnOutput`
  - shared model config types (provider name, model id, temperature, token limits)
  - helpers for “structured outputs” + a standard repair loop contract (retry caps, error shape)
- Provider adapters (examples):
  - OpenAI adapter implements `LLMClient`
  - Anthropic adapter implements `LLMClient`
- Selection mechanism:
  - choose provider/model via env/config (`LLM_PROVIDER`, `LLM_MODEL`, etc.)
  - wire via dependency injection (not inside the engine core)
- For image generation, mirror the same approach:
  - define an `ImageClient` interface
  - add provider-specific adapters as needed
  - default model of choice: Gemini “nano banana” (configured, not hard-coded)

### 4) Engine core (pure + deterministic)

In `apps/api` implement:

- `challengeGenerator(seed, tier)` (Tier 1–3)
- `DeliberationEngine` FSM implementing phases/round schedule from `docs/spec.md`
- Validator rules from `docs/tech.md`:
  - “no +1” enforcement
  - contrarian objection required
  - no consecutive proposals
  - Synthesizer traceability (`references` + amendments tied to referenced items)
  - phase write restrictions on canon paths
- Voting rules from `docs/spec.md` (ACCEPT/AMEND/REJECT thresholds + Synthesizer deadlock tie-breaker; Phase 4 unanimous ratification)
- Repair loop API (`validate → repairPrompt → revalidate`, capped retries)
- Transcript as append-only `MatchEvent[]` + `canon_hash` before/after for deterministic replay

### 5) API app (runs matches + streams events)

In `apps/api` (FastAPI/Starlette):

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

In `apps/api` + endpoints:

- PromptEngineer runs on final validated canon only (fairness)
- Generate/store 6 artifacts/team (or prompts-only MVP); image generation default is Gemini “nano banana” via `ImageClient`
- Blind packager that strips team labels for judging

In `apps/web`:

- Gallery view
- (Later) judge scoring UI using rubric from `docs/spec.md`

## Recommended MVP cut (fastest end-to-end)

- Run full match orchestration + validation + SSE + UI replay, but stop at “PromptPack generated” (no image generation yet).
- Add image generation + storage once the match loop and mobile UI feel solid.

## Open choices to confirm (affects plan details)

- API framework: FastAPI/Starlette vs something else + SSE implementation style
- Schema codegen: how to generate TS + Python types/models from JSON Schema (tooling choice + where generated code lives)
- Persistence: SQLite first vs Postgres from day 1
- LLM provider(s) + models: pick a default adapter, but keep `LLMClient` provider-neutral
- Image generation: default Gemini “nano banana”, but keep `ImageClient` provider-neutral; confirm storage (local files vs S3-compatible)
