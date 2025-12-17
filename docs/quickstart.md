# Worldbuild Arena — Quickstart

## Prereqs

- Node.js (recommended: 20+)
- `pnpm` (repo pins `pnpm@10.x`)
- Python 3.11+

If you don’t have `pnpm` installed, you can use Corepack:

```bash
corepack enable
```

## Install

```bash
pnpm install
pnpm setup:api
```

## Run (web + API)

```bash
pnpm dev
```

- Web: `http://localhost:5173`
- API: `http://localhost:8000`

The default LLM provider is `mock`, so you can run matches without any API keys.

## Run a match

1. Open the web app.
2. Click **Start match** (optionally set Tier/Seed).
3. Use the **Timeline** controls to replay/scrub the event log.

## LLM providers (optional)

The orchestrator supports provider adapters via env vars:

```bash
# Default (no keys needed)
export LLM_PROVIDER=mock

# OpenAI
export LLM_PROVIDER=openai
export OPENAI_API_KEY=...

# Anthropic
export LLM_PROVIDER=anthropic
export ANTHROPIC_API_KEY=...

# Gemini
export LLM_PROVIDER=gemini
export GEMINI_API_KEY=...
```

Optional tuning:

```bash
export LLM_MODEL=...
export LLM_TEMPERATURE=0.7
export LLM_MAX_OUTPUT_TOKENS=900
```

## Useful endpoints

- `GET /health`
- `POST /matches` → `{ seed?, tier }`
- `GET /matches/{match_id}/events` (SSE, supports `?after=N`)
- `GET /matches/{match_id}/artifacts` (canon + prompt packs)
- `GET /matches/{match_id}/judging/blind` (blind package)
- `POST /matches/{match_id}/judging/scores` (submit scores)

## DB location

SQLite is stored at `apps/api/data/worldbuild.sqlite3` by default.

Override with:

```bash
export WBA_DB_PATH=/path/to/worldbuild.sqlite3
```

## Tests / build

```bash
pnpm test
pnpm build
```
