# Worldbuilding Sprint — Design Specification v0.1

---

## Concept

Two teams of LLM agents, each with distinct roles, are given identical worldbuilding constraints. Through structured deliberation, each team develops a coherent fictional location. The debate produces a detailed spec, which is then fed to image generation models to create visual artifacts. Teams are judged on both the quality of their deliberation and the coherence/creativity of their outputs.

---

## Team Composition

Each team consists of **4 agents** with enforced roles:

| Role            | Mandate                                                                      | Personality Pressure          |
| --------------- | ---------------------------------------------------------------------------- | ----------------------------- |
| **Architect**   | Proposes structural/physical elements (geography, buildings, infrastructure) | Thinks in systems and spaces  |
| **Lorekeeper**  | Proposes history, culture, inhabitants, naming conventions                   | Thinks in stories and meaning |
| **Contrarian**  | Must challenge every proposal with a specific objection or edge case         | Constructively adversarial    |
| **Synthesizer** | Resolves conflicts, merges ideas, calls for votes, manages convergence       | Diplomatic, decisive          |

**Key constraint:** No agent can agree with a proposal without adding something or modifying it. Pure "+1" responses are forbidden. This forces genuine discourse.

---

## Competition Flow

```
┌─────────────────────────────────────────────────────────────┐
│ PHASE 0: CHALLENGE REVEAL                                   │
│ Both teams receive identical constraints                    │
│ (biome, inhabitant type, one "twist" constraint)            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: FOUNDATION (3 rounds)                              │
│ Establish core identity: name, governing logic, vibe        │
│ Architect and Lorekeeper alternate proposals                │
│ Contrarian must object; Synthesizer resolves                │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 2: LANDMARK DEVELOPMENT (4 rounds)                    │
│ Define 3 key landmarks/locations within the world           │
│ Each must connect to the governing logic                    │
│ Contrarian pressure-tests for internal consistency          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 3: TENSION INJECTION (2 rounds)                       │
│ Team must identify a conflict/problem in their world        │
│ Something unresolved that makes it feel alive               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 4: SPEC CRYSTALLIZATION (1 round)                     │
│ Synthesizer produces final structured spec                  │
│ Team votes to ratify (must be unanimous)                    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 5: ARTIFACT GENERATION                                │
│ Neutral "Prompt Engineer" agent converts spec → image       │
│ prompts. Generation model produces artifacts.               │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 6: BLIND JUDGMENT                                     │
│ Judge(s) score artifacts + transcripts without team labels  │
└─────────────────────────────────────────────────────────────┘
```

---

## Challenge Generation

Each competition begins with a randomized challenge. Structure:

```
CHALLENGE #[N]

BIOME/SETTING: [randomly selected]
  Examples: volcanic archipelago, frozen megastructure,
  subterranean fungal forest, floating desert islands

INHABITANTS: [randomly selected]
  Examples: posthuman monks, symbiotic hive-beings,
  nomadic machine-spirits, amphibious traders

TWIST CONSTRAINT: [randomly selected]
  Examples: "light is sacred and rationed", "all structures
  must be temporary", "vertical space is status", "the
  founders are still alive but sleeping"
```

**Challenge Difficulty Tiers:**

- **Tier 1 (Easy):** Coherent combinations (desert + nomads + water scarcity)
- **Tier 2 (Medium):** Mild tension (arctic + traders + "fire is forbidden")
- **Tier 3 (Hard):** Paradoxical (underwater city + "inhabitants fear submersion")

---

## Deliberation Protocol

### Turn Structure

Each round follows this sequence:

```
1. PROPOSAL    — Architect or Lorekeeper (alternating) makes a proposal
2. OBJECTION   — Contrarian raises specific concern or edge case
3. RESPONSES   — Other agents respond (no pure agreement allowed)
4. RESOLUTION  — Synthesizer summarizes, proposes resolution, calls vote
5. VOTE        — All agents vote ACCEPT / AMEND / REJECT
                 (AMEND requires stating the amendment)
```

### Voting Rules

- **ACCEPT** (3+ votes): Proposal enters canon
- **AMEND** (2+ votes for same amendment): Modified proposal enters canon
- **REJECT** (2+ votes): Proposal discarded, next proposer must address the gap
- **DEADLOCK**: Synthesizer has tie-breaker authority but must justify

### Discourse Constraints

| Rule                                          | Rationale                  |
| --------------------------------------------- | -------------------------- |
| No agent may make consecutive proposals       | Prevents dominance         |
| Contrarian must object to every proposal      | Forces stress-testing      |
| Objections must be specific and actionable    | No vague "I don't like it" |
| Synthesizer cannot propose, only merge/refine | Keeps them neutral         |
| All agents see full transcript                | Shared context             |

---

## Final Spec Structure

Phase 4 produces a structured document:

```yaml
world_name: ""
governing_logic: ""  # The one rule that explains everything
aesthetic_mood: ""   # 3-5 adjectives

landmarks:
  - name: ""
    description: ""
    significance: ""  # Why it matters to inhabitants
    visual_key: ""    # Most striking visual element
  - name: ""
    ...
  - name: ""
    ...

inhabitants:
  appearance: ""
  culture_snapshot: ""
  relationship_to_place: ""

tension:
  conflict: ""
  stakes: ""
  visual_manifestation: ""  # How you'd SEE this tension

hero_image_description: |
  # The single most important image to generate
  # Written as a detailed scene description
```

---

## Artifact Requirements

Each team produces:

| Artifact                | Description                         | Generation Approach              |
| ----------------------- | ----------------------------------- | -------------------------------- |
| **Hero Image**          | Wide establishing shot of the world | Single detailed prompt from spec |
| **Landmark Triptych**   | 3 images, one per landmark          | Individual prompts per landmark  |
| **Inhabitant Portrait** | Single figure in context            | Character + environment prompt   |
| **Tension Snapshot**    | Scene depicting the conflict        | Narrative moment prompt          |

**Total: 6 images per team**

### Prompt Engineering Agent

A neutral 5th agent (shared, not team-affiliated) converts specs into generation prompts. This ensures:

- Teams can't "game" prompt engineering
- Fair comparison (same translator for both)
- Spec quality is what matters, not prompt-fu

---

## Judging Rubric

### Category Weights

| Category               | Weight | What It Measures                                  |
| ---------------------- | ------ | ------------------------------------------------- |
| **Internal Coherence** | 25%    | Do all elements follow from the governing logic?  |
| **Creative Ambition**  | 20%    | Is it genuinely novel, or derivative?             |
| **Visual Fidelity**    | 20%    | Do images match the spec?                         |
| **Artifact Quality**   | 20%    | Are the images compelling on their own?           |
| **Process Quality**    | 15%    | Was the debate productive? Did they resolve well? |

### Scoring Scale

```
5 — Exceptional: Could not reasonably be better
4 — Strong: Minor gaps or missed opportunities
3 — Competent: Meets expectations, nothing remarkable
2 — Weak: Significant issues or incoherence
1 — Failed: Does not satisfy basic requirements
```

### Blind Judging Protocol

1. Judge receives both final specs (Team labels removed)
2. Judge receives both artifact sets (Team labels removed)
3. Judge scores each category independently
4. Only after scoring: reveal which team produced which
5. Optional: Judge reviews transcripts for Process Quality score

---

## Technical Architecture (Sketch)

```
orchestrator.py
├── challenge_generator.py    # Produces random challenges
├── team.py                   # Manages agent ensemble
│   ├── architect_agent.py
│   ├── lorekeeper_agent.py
│   ├── contrarian_agent.py
│   └── synthesizer_agent.py
├── deliberation_engine.py    # Enforces turn order, voting, constraints
├── spec_extractor.py         # Converts transcript → structured spec
├── prompt_engineer_agent.py  # Converts spec → image prompts
├── generator.py              # Calls image gen API
├── judge.py                  # Scoring interface
└── transcript_logger.py      # Saves full deliberation record
```

### Agent Prompt Structure (Template)

```
You are the {ROLE} on a worldbuilding team.

YOUR MANDATE: {ROLE_MANDATE}

CURRENT CHALLENGE:
{CHALLENGE_TEXT}

DELIBERATION SO FAR:
{TRANSCRIPT}

CURRENT PHASE: {PHASE_NAME}
YOUR TURN TYPE: {PROPOSAL | OBJECTION | RESPONSE | RESOLUTION}

CONSTRAINTS:
- {ROLE_SPECIFIC_CONSTRAINTS}
- You may not simply agree. You must add, modify, or object.
- Be specific and actionable.

Respond in character. Be concise but substantive.
```

---

## Open Questions / Future Iterations

1. **Model mixing:** Should teams use heterogeneous models (e.g., Claude + GPT on same team)?
2. **Audience participation:** Could live viewers inject "curveball" constraints mid-deliberation?
3. **Tournament structure:** Single elimination? Round robin? Elo rating?
4. **Asymmetric challenges:** Same biome, different inhabitants — compare solutions?
5. **Human-in-the-loop:** One human on each team as a 5th "wildcard" agent?

---

## Next Steps

1. **Prototype single-team deliberation** — Get one team working end-to-end
2. **Tune role prompts** — Contrarian too aggressive? Synthesizer too passive?
3. **Test spec → image fidelity** — Does the prompt engineer preserve intent?
4. **Run head-to-head** — Two teams, same challenge, blind judge
5. **Iterate on judging rubric** — What actually predicts "this world is cool"?
