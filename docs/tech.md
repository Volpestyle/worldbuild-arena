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
  - MVP: stylized low-poly or capsule characters (cheap to animate, easy to read)
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
- **Implementation**: can be either TypeScript/Node or Python (the orchestration + validation layer is where Python often feels especially ergonomic, but it’s not required)

---

## 1. Core idea: an “agent” is a contract, not a process

From a dev standpoint, treat each agent as a pure function plus state injection:

`Agent = (Role Prompt + Turn Contract + Shared Team State) → (Structured Turn Output)`

You do not need “long-running agent processes.” Each agent “retains identity” because your orchestrator repeatedly calls the model with:

- the same role instructions (Architect/Lorekeeper/etc.)
- the same constraints
- the same team transcript/canon state

If you want server-managed memory, some LLM providers support persistent “conversations” / threads (for example, OpenAI Responses `conversations`). Treat this as an optional adapter feature — the orchestrator should still use your DB-backed transcript + canon as the source of truth.

But for this spec (10-ish rounds, bounded scope), app-managed transcript + canon is simplest, deterministic, and easy to validate.

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
- **Generator**: calls image generation model
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

Every call to the model should be constructed from deterministic parts.

### 5.1 Prompt template layers

1. Role instructions (system/developer)
   - mandate
   - personality pressure
   - non-negotiable constraints (no +1, etc.)
2. Match context (user)
   - challenge
   - current phase/round index
   - “your turn type”
3. Shared state (user)
   - current canon JSON snapshot
   - last N transcript events (or full transcript if small)

### 5.2 Example LLM API call (conceptual)

(Exact field names vary by SDK version, but the structure is the same.)

- Provide role-level system guidance (e.g., `instructions` / system prompt, depending on SDK).
- Configure structured output (JSON schema) using your provider’s mechanism (e.g., OpenAI `text.format`).
- Limit tokens (`max_output_tokens` or provider equivalent).

You can also attach metadata for traceability (`agent_id`, `match_id`, `team_id`).

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

## 10. Identity & conversation state options (practical tradeoffs)

### Option A (recommended MVP): app-managed state injection

- Store transcript + canon in your DB.
- Each agent call includes:
  - role instructions
  - full/partial transcript
  - canon snapshot
- Pros: deterministic, portable, easy to test
- Cons: more tokens per call

### Option B: Provider-managed conversations per team or per agent

Some providers offer durable conversation/thread objects. For example, OpenAI Responses supports `conversations`, where items are prepended and new items are added automatically.

If you do this:

- Create a conversation/thread ID for each agent or each team (provider-specific; e.g., `conversation_id`).
- Add each structured turn output as conversation items (or rely on the provider SDK to append them).
- Still keep canon in your DB (don’t rely on the model’s memory as the source of truth).

### Option C: Provider request chaining (e.g., `previous_response_id`)

Some APIs support chaining requests via a previous response ID (OpenAI: `previous_response_id`). If you do this, note:

- in some APIs (e.g., OpenAI), instructions are not carried over when chaining — you must resend them
- in some APIs (e.g., OpenAI), you can’t use conversation and chaining together

Given your need for strict role behavior, Option A or B is typically cleaner.

---

## 11. “Neutral Prompt Engineer” agent

Treat PromptEngineer as another structured-output agent with strict schema.

PromptPack schema:

- `hero_image_prompt`
- `landmark_prompts[3]`
- `inhabitant_portrait_prompt`
- `tension_snapshot_prompt`
- optional: `negative_prompt`, `style_tags`, `camera_notes`

Implementation details:

- PromptEngineer input is only the final validated canon/spec (no transcript).
- It must be shared across both teams for fairness.

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
src/
  orchestrator/
    match_runner.py
    deliberation_engine.py   # FSM scheduler
    validator.py             # schema + business rules
    canon_store.py           # apply/verify patches
    transcript_store.py      # event logging
  agents/
    agent_base.py            # build prompt + call model + parse
    role_prompts.py          # versioned prompts/config
    schemas.py               # JSON schema definitions
  challenge/
    generator.py             # seeded RNG + tiers
  artifacts/
    prompt_engineer.py       # neutral prompt pack generation
    image_generator.py       # calls image model + stores results
  judging/
    blind_packager.py
    judge_interface.py
```

---

## 14. Key engineering principles for this project

1. Canon is truth; transcript is audit.
2. Every agent output must be structured JSON (not freeform prose).
3. Validators enforce the game rules, not prompts alone.
4. Deterministic orchestration beats “emergent coordination” (especially for fairness).
5. Neutral PromptEngineer is a separate agent + schema, not a hand-edited step.

---

If you want, I can follow this up with:

- a concrete JSON Schema for TurnOutput + Canon
- a deterministic “Phase/round schedule” object (so matches are replayable)
- pseudocode for `DeliberationEngine.run_team(team, challenge)` including the repair loop and vote resolution
