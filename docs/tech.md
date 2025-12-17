# Worldbuilding Sprint — Agent Implementation Design v0.1 (Technical)

This document focuses on the engineering approach for creating and running the 4-role “agents” described in your spec (Architect, Lorekeeper, Contrarian, Synthesizer), enforcing discourse rules, and producing a final structured world spec suitable for downstream prompt engineering + image generation.

---

## 0. Technical stack (web UI + platform)

This spec is intentionally backend-agnostic, but the product benefits from a first-class web UI for running matches, watching turn-by-turn state updates, and reviewing transcripts/artifacts.

### Frontend

- **Framework**: **React** (recommend TypeScript)
- **3D**: **three.js** (render the match as a scene: Team A and Team B as 3D avatars seated at separate roundtables)
- **UI + motion**: **Framer Motion** (HUD/overlay UI + smooth animated state transitions)

### UI concept: “match as a living diorama”

Treat the match as a replayable, turn-based performance that’s visually legible at a glance:

- **Two roundtables** in a shared “arena” scene (Team A table on the left, Team B on the right).
- **Four avatars per table** (Architect, Lorekeeper, Contrarian, Synthesizer), each with consistent visual identity:
  - color accent per role, role glyph, and a “speaking” indicator
  - optional: a neutral “Prompt Engineer” station that activates only during artifact generation
- **Diegetic match state** shown in-world (e.g., floating nameplates, subtle lighting shifts for phase changes), while details live in the HUD.

### Scene layout (three.js)

- **Camera**: a default wide angle framing both tables; allow orbit/pan/zoom with snap-to views:
  - “Both Teams” (wide)
  - “Team A” / “Team B” (medium)
  - “Speaker Close-up” (tight)
- **Environment**: neutral arena with controllable mood lighting; phase changes can alter rim light color, fog density, or background motif.
- **Tables**: circular tables with 4 seats; per-seat “turn lamps” that light up when that role is active.
- **Avatars**:
  - MVP: stylized low-poly characters (cheap to animate, easy to read)
  - Later: swappable GLTF rigs; role-specific idle animations (thinking, pointing, disagreeing, summarizing)

Implementation note: using a React renderer for three.js (e.g., `@react-three/fiber`) simplifies state-driven updates and co-locates React UI state with scene state, while still using three.js under the hood.

### HUD overlay (React + Framer Motion)

HUD should be an always-available layer that can expand/collapse without obscuring the scene:

- **Top bar**: match ID, seed, challenge summary, current phase/round, run status (running/paused/complete).
- **Left/right panels**: Team A / Team B:
  - current speaker + turn type (PROPOSAL/OBJECTION/RESPONSE/RESOLUTION/VOTE)
  - last turn content (collapsed by default; expand for full text)
  - vote tally visualization
- **Canon panel**: live canonical world state with diff view (before/after patch) and “phase write restrictions” warnings when applicable.
- **Timeline controls**: play/pause, step turn, scrub (when replaying), speed control, “jump to round/phase”.
- **Artifact gallery**: hero image + landmark triptych + portrait + tension snapshot, revealed as they’re generated.

Framer Motion responsibilities:

- panel transitions (expand/collapse, slide-in, crossfade)
- focus/attention cues (pulse on active speaker, shake on validation failure, glow on canon acceptance)
- timeline scrubbing with smooth interpolation of UI state

### Mapping match events → visuals (animation beats)

Use the structured transcript as the single driver of presentation:

- **Turn start**: speaker avatar highlights; seat lamp turns on; subtle camera nudge toward the active table.
- **PROPOSAL**: speaker performs “present” gesture; HUD shows proposed patch targets (field-level).
- **OBJECTION**: contrarian gets a stronger accent (e.g., red edge light); a “stress-test” indicator appears.
- **RESOLUTION**: Synthesizer triggers a merge animation; canon panel animates patch application.
- **VOTE**: each avatar emits a token (ACCEPT/AMEND/REJECT) into a bowl; tally resolves to a result state.
- **Validation/repair loop**: brief “error” stinger (HUD + world), then “repair” retry animation; transcript preserves the validator error for replay/debug.

### Data + runtime integration

- **Primary stream**: transcript events + canon snapshots/diffs (SSE is a good default; WebSockets if you need bidirectional control).
- **Client state model**: treat events as append-only; UI derives “current view” from an event index (enables deterministic replay/scrubbing).
- **Asset strategy**: start with lightweight primitives; treat higher-fidelity avatars/props as optional content packs to avoid blocking MVP.

### Backend (orchestrator API)

- **Interface**: JSON over HTTP + streaming updates (SSE recommended; WebSockets optional)
- **Responsibilities**: run DeliberationEngine, validate/repair, apply canon patches, persist transcripts/artifacts
- **Contracts**: schema-first JSON Schema (generate Python/TS bindings; validate all agent outputs against the same schemas)
- **Implementation**: Python (this repo’s default), but can be TypeScript/Node or Go if you keep contract/codegen parity

---

## 1. Core idea: an "agent" is a contract, not a process

From a dev standpoint, treat each agent as a pure function within a provider-managed conversation:

`Agent = (Role Prompt + Turn Context) → (Structured Turn Output)`

You do not need "long-running agent processes." Each agent "retains identity" because the LLM provider maintains conversation state, and your orchestrator chains requests using `previous_response_id`.

**Architecture decision (implemented):** We use **provider-managed conversation state** via OpenAI's Responses API. This means:

- One conversation per team (Team A and Team B are independent)
- All 4 agents share their team's conversation thread
- The provider remembers the full deliberation history
- Each turn only needs minimal context (role, turn type, phase info)
- Token savings: ~60-80% vs. re-injecting full transcript each call

The tradeoff: we rely on the provider as the source of truth for conversation context. Canon patches are still validated and applied locally, and events are logged to SQLite for replay/audit.

---

## 2. System overview

### Runtime objects

- **Match**: one head-to-head run with a single Challenge
- **Team**: A or B; owns transcript, canon, 4 agents
- **Agent**: role-config + runtime constraints + model config
- **DeliberationEngine**: turn scheduler + rule enforcer
- **Validator**: schema + discourse constraints
- **CanonStore**: applies accepted amendments into canonical world state
- **PromptEngineer**: neutral 5th agent translating final spec → image prompts
- **Generator**: calls image generation model (default: Gemini “nano banana”, behind an adapter)
- **Judge**: blind scoring (humans or model judges)

### High-level dataflow

1. Challenge generated (seeded).
2. Team A + Team B run identical deliberation protocol.
3. Each team outputs:
   - Final spec (YAML/JSON)
   - Transcript (events)
4. Neutral PromptEngineer creates 6 prompts/team.
5. Image generation produces 6 artifacts/team.
6. Blind judge scores.

---

## 3. Agent design

### 3.1 Agent configuration (static)

Store agent configs as versioned data, not hard-coded strings:

```json
{
  "role": "ARCHITECT",
  "mandate": "Proposes structural/physical elements...",
  "personality_pressure": "Thinks in systems and spaces",
  "constraints": [
    "No pure agreement (+1 forbidden). Must add/modify/object.",
    "Must produce output in required JSON schema."
  ],
  "model": "gpt-4.1-mini",
  "temperature": 0.7,
  "max_output_tokens": 900
}
```

### 3.2 Agent state (per match)

You can keep agent state minimal because context is shared:

```json
{
  "agent_id": "A-ARCH-01",
  "team_id": "A",
  "role": "ARCHITECT",
  "turn_count": 0,
  "last_turn_type": null,
  "budget": {
    "calls_remaining": 50,
    "tokens_remaining": 200000
  }
}
```

Optional: store agent-specific “notes,” but if you want strict fairness and “all agents see full transcript,” avoid private memory.

---

## 4. Turn I/O contract (structured outputs)

### 4.1 Why structured outputs

You need machine-checkable outputs to enforce:

- “No +1”
- Contrarian must object
- Voting rules
- Canon updates

Use structured outputs (JSON Schema) when your provider supports them; this is how you enforce rules without brittle text parsing.

Provider note: in OpenAI Responses, structured output is configured under `text.format` (and supports a strict mode).

### 4.2 Standard turn schema

All agent turns should emit JSON with a strict schema.

TurnOutput (example schema fields):

- `speaker_role`: `"ARCHITECT" | "LOREKEEPER" | "CONTRARIAN" | "SYNTHESIZER"`
- `turn_type`: `"PROPOSAL" | "OBJECTION" | "RESPONSE" | "RESOLUTION" | "VOTE"`
- `content`: markdown-ish text, but bounded (bullets)
- `canon_patch`: list of patch ops (only when proposing or amending)
- `references`: IDs of proposals/objections being responded to (important for Synthesizer neutrality)
- `vote`: only when `turn_type == "VOTE"`

### 4.3 Canon patch format

Use RFC-6902 JSON Patch style (easy to apply + diff), or a simplified subset:

- `add`
- `replace`
- `remove`

Example:

```json
{
  "canon_patch": [
    {
      "op": "replace",
      "path": "/governing_logic",
      "value": "Light is sacred and rationed..."
    },
    {
      "op": "add",
      "path": "/landmarks/-",
      "value": {
        "name": "The Prism Sluice",
        "description": "...",
        "significance": "...",
        "visual_key": "..."
      }
    }
  ]
}
```

This is the key technical trick: canon becomes the authoritative state, and the transcript becomes an audit trail.

---

## 5. Prompt assembly

With provider-managed conversation state, prompts are simpler. The provider remembers context; we just provide turn-specific instructions.

### 5.1 Conversation initialization (once per team)

When starting a team's conversation, include:

1. System prompt with all role mandates and discourse rules
2. Challenge details (biome, inhabitants, twist constraint)
3. Initial canon state (placeholder structure)

This is sent once via `start_conversation()` and the provider retains it.

### 5.2 Per-turn prompt (minimal)

Each subsequent turn only needs:

- Current role (ARCHITECT/LOREKEEPER/CONTRARIAN/SYNTHESIZER)
- Turn type (PROPOSAL/OBJECTION/RESPONSE/RESOLUTION/VOTE)
- Phase and round number
- Allowed patch prefixes (for validation feedback)
- Expected references (for RESOLUTION turns)
- Repair errors (if retrying after validation failure)

The provider chains this via `previous_response_id`, so it sees the full conversation history without us resending it.

### 5.3 Structured output

Configure structured output using the provider's mechanism:

- OpenAI Responses API: `text.format.type = "json_schema"` with `strict: True`
- Schema: TurnOutput (from `packages/contracts/schemas/`)

This guarantees valid JSON matching our schema, eliminating parse errors.

---

## 6. Orchestration and rule enforcement

### 6.1 Turn scheduler (DeliberationEngine)

Implement the protocol as a deterministic finite state machine.

Per round:

1. **PROPOSAL** — alternating: Architect ↔ Lorekeeper
2. **OBJECTION** — Contrarian (mandatory)
3. **RESPONSES** — remaining agents in fixed order (e.g., Architect → Lorekeeper → Contrarian → Synthesizer excluding proposer)
4. **RESOLUTION** — Synthesizer
5. **VOTE** — all agents

This is fully deterministic and requires no agent autonomy about turn order.

### 6.2 Enforcing “no consecutive proposals”

That is a scheduler constraint:

- Store last proposer role.
- Next round proposer must be the other of `{Architect, Lorekeeper}`.

### 6.3 Enforcing “Contrarian must object”

Also scheduler + validator:

- Scheduler always calls Contrarian with `turn_type=OBJECTION`.
- Validator rejects outputs without at least one actionable objection.

### 6.4 Enforcing “no +1 responses”

This is best enforced with both schema + content heuristics.

Hard requirement in schema:

- For `RESPONSE` turns, require at least one of:
  - `canon_patch` non-empty, or
  - `content` contains a “delta” section with explicit additions/modifications.

Heuristic validator (backup):

- Reject responses matching patterns like `^(\\+1|agree|sounds good|yes)$` (case-insensitive) without a patch or delta.
- Reject responses below a minimum token/character threshold (e.g., `< 120 chars`) unless they include a patch.

### 6.5 Synthesizer neutrality

You can’t perfectly prove “no new ideas introduced,” but you can enforce traceability.

Require Synthesizer `RESOLUTION` output to include:

- `references`: list of proposal/objection IDs it is merging
- `decision`: `"ACCEPT" | "AMEND" | "REJECT" | "DEADLOCK_TIEBREAK"`
- `canon_patch`: only amendments that are explicitly tied to referenced items

Validator checks:

- `references.length >= 1`
- if `decision == "AMEND"`, then `canon_patch` must be non-empty
- resolution must include a short justification referencing objections (e.g., must mention at least one objection ID)

---

## 7. Validation + repair loop

### 7.1 Two-stage validation

1. Schema validation
   - parse JSON
   - validate against JSON Schema
2. Business rule validation
   - role-specific constraints
   - turn-type constraints
   - patch validity (paths allowed in this phase)

### 7.2 Repair strategy (important)

When validation fails:

- Do not silently accept.
- Immediately run a “repair prompt” call to the same agent:
  - include the invalid output + validator errors
  - ask it to output corrected JSON only

Bound this to 1–2 retries to avoid infinite loops.

This keeps the transcript clean and makes errors observable.

---

## 8. Canon model (world state)

Represent canon in JSON internally; serialize to YAML only at the end.

Canon fields align with your final spec:

- `world_name`
- `governing_logic`
- `aesthetic_mood` (array)
- `landmarks` (array of 3 objects)
- `inhabitants` (object)
- `tension` (object)
- `hero_image_description` (string)

### Phase-scoped write access

To prevent early drift, restrict which fields can be modified per phase:

- Phase 1 (Foundation): `world_name`, `governing_logic`, `aesthetic_mood`, plus placeholders
- Phase 2 (Landmarks): `landmarks[]`
- Phase 3 (Tension): `tension`
- Phase 4 (Crystallization): all fields allowed, but must pass final schema

Validator rejects patches that touch disallowed paths for the current phase.

---

## 9. Transcript logging (event-sourced)

Instead of “just logging text,” log structured events:

```json
{
  "event_id": "evt_00123",
  "match_id": "m_2025_12_14_0001",
  "team_id": "A",
  "round": 2,
  "phase": "FOUNDATION",
  "speaker_role": "LOREKEEPER",
  "turn_type": "PROPOSAL",
  "turn_output": { "...": "validated JSON..." },
  "canon_before_hash": "sha256:...",
  "canon_after_hash": "sha256:...",
  "timestamp": "2025-12-14T18:22:11Z",
  "llm_metadata": {
    "model": "provider:model-id",
    "response_id": "resp_...",
    "tokens_in": 1234,
    "tokens_out": 456
  }
}
```

Benefits:

- perfect replayability (“re-run match”)
- easy analytics (which role causes deadlocks, etc.)
- easy blind packaging for judges

---

## 10. Identity & conversation state (implemented approach)

### Provider-specific strategies

We use different approaches per provider to optimize for their capabilities:

**OpenAI: Response chaining** — Uses Responses API with `previous_response_id`:

```
start_conversation() → response_id_0
generate_turn(previous_response_id=response_id_0) → response_id_1
generate_turn(previous_response_id=response_id_1) → response_id_2
...
```

**Key design points:**

- **One conversation per team**: Team A and Team B each get their own conversation thread
- **All 4 agents share the thread**: The provider sees the full deliberation as a single conversation
- **ConversationHandle**: An opaque wrapper that stores `response_id` and gets passed between turns
- **Canon still local**: We apply and validate patches locally in SQLite; provider just remembers the discussion

**Anthropic: App-managed state + prompt caching** — Stores conversation locally, resends each call:

```
start_conversation() → stores system prompt + schema in handle
generate_turn() → sends full messages[] array with cache_control on system prompt
```

Anthropic's API is stateless, so we:
- Store conversation history in `ConversationHandle.data["messages"]`
- Resend full message array each call
- Use `cache_control: {"type": "ephemeral"}` on system prompt for prompt caching
- Use tool_use with forced tool choice for structured output

### Token comparison

| Provider | Strategy | Tokens per late-game call | Cost optimization |
|----------|----------|---------------------------|-------------------|
| OpenAI | Response chaining | ~500-1,000 | Provider remembers context |
| Anthropic | App-managed + cache | ~2,000-4,000 | Prompt caching reduces cost by ~90% on cached prefix |
| Mock | N/A | 0 | For testing only |

### Tradeoffs by provider

**OpenAI:**
- Pro: Minimal tokens per call
- Con: Provider is source of truth for context

**Anthropic:**
- Pro: Full control over conversation state
- Con: More bytes over the wire (mitigated by prompt caching)

### Alternative approaches (not chosen)

**Option A: App-managed state injection** — Each call includes full transcript + canon. More portable and testable, but ~3-4x more expensive in tokens.

**Option B: Provider conversations API** — Use `conversation_id` for persistent threads. Similar benefits to chaining, but different API surface.

---

## 11. “Neutral Prompt Engineer” agent

Treat PromptEngineer as another structured-output agent with strict schema.

PromptPack schema (recommended: **structured prompts**, not raw strings):

- `style_profile` (optional shared defaults: medium, rendering style, banned elements, etc.)
- `hero_image` (`ImagePrompt`)
- `landmarks[3]` (`ImagePrompt`)
- `inhabitant_portrait` (`ImagePrompt`)
- `tension_snapshot` (`ImagePrompt`)

`ImagePrompt` fields (store as JSON; render per-provider in `ImageClient`):

- `rendered_prompt` (required string; what you actually send to the image model today)
- `spec` (required object; the “high-detail” structured description)
  - e.g. `subject`, `setting`, `composition`, `camera`, `lighting`, `materials`, `palette`, `mood`, `style_tags`
- `negative_prompt` (optional string)
- `params` (optional object; aspect ratio, size, seed, guidance, etc. as supported)
- `canon_refs` (optional list; pointers into canon for traceability/debugging)

Implementation details:

- PromptEngineer input is only the final validated canon/spec (no transcript).
- It must be shared across both teams for fairness.
- Enforce “sufficient detail” via schema + validator rules (required subfields, minimum lengths, and/or required coverage like camera + lighting + composition for every prompt). Even if the upstream image model is text-only, keeping the prompt *structured* lets you validate, diff, and re-render consistently across providers.

---

## 12. Testing strategy (so this doesn’t become prompt spaghetti)

### 12.1 Unit tests

- Patch application correctness
- Phase write restrictions
- Vote aggregation (ACCEPT/AMEND/REJECT rules)
- Validator: “no +1” detection, contrarian objection presence, schema adherence

### 12.2 Deterministic integration tests

- Use a fixed seed challenge.
- Mock the model with canned JSON outputs to test orchestration.
- Verify canon evolves exactly as expected.

### 12.3 “Fuzz” tests

- Random challenges (Tier 1–3)
- Randomized order of response turns (within allowed protocol)
- Ensure no crashes, all outputs validate, deadlocks resolved

---

## 13. Implementation skeleton (practical module boundaries)

```text
packages/contracts/
  schemas/                   # JSON Schemas (source of truth)

apps/api/                     # Python orchestrator API
  pyproject.toml
  src/worldbuild_api/
    contracts/                # generated models (optional; schemas remain source of truth)
    orchestrator/             # match runner + wiring
    engine/                   # FSM scheduler
    validator/                # schema + business rules + repair loop
    canon/                    # apply/verify patches
    transcript/               # event logging + persistence
    agents/                   # role prompts/config + LLM invocation
    challenge/                # seeded RNG + tiers
    artifacts/                # prompt engineer + image generation
    judging/                  # blind packaging + judge interface
  tests/

apps/web/                     # React/TS UI (event replay)
  src/
```

---

## 14. Key engineering principles for this project

1. **Adapter pattern for providers.** Each provider uses its optimal strategy (OpenAI: response chaining, Anthropic: app-managed + prompt caching). The engine doesn't know the difference.
2. **Every agent output must be structured JSON** (not freeform prose). OpenAI uses `json_schema`, Anthropic uses `tool_use` with forced choice.
3. **Validators enforce the game rules**, not prompts alone. The provider can't guarantee discourse rules; we validate after each turn.
4. **Deterministic orchestration** beats "emergent coordination" (especially for fairness). Turn order is fixed by the FSM scheduler.
5. **Neutral PromptEngineer** is a separate agent + schema, not a hand-edited step.
6. **Optimize for token cost per provider.** OpenAI: response chaining. Anthropic: prompt caching. Both reduce costs significantly vs. naive resending.
