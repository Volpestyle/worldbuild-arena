import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Canon, PromptPack, TeamId } from "@wba/contracts";

import { ArenaScene } from "./components/ArenaScene";
import { useMatchStream } from "./hooks/useMatchStream";
import { API_BASE_URL, blindJudgingUrl } from "./lib/api";
import { deriveMatchView } from "./lib/derive";

type AppTab = "match" | "canon" | "artifacts" | "judge";

type BlindEntry = {
  blind_id: string;
  canon: Canon;
  prompt_pack: PromptPack | null;
};

type BlindPackageResponse = {
  match_id: string;
  entries: BlindEntry[];
};

type JudgingScores = {
  internal_coherence: number;
  creative_ambition: number;
  visual_fidelity: number;
  artifact_quality: number;
  process_quality: number;
};

export function App() {
  const { matchId, connectionStatus, events, error, startMatch } = useMatchStream();

  const [tier, setTier] = useState<1 | 2 | 3>(1);
  const [seedInput, setSeedInput] = useState<string>("");

  const [tab, setTab] = useState<AppTab>("match");
  const [cameraPreset, setCameraPreset] = useState<"both" | "teamA" | "teamB" | "speaker">("both");

  const [reduceMotion, setReduceMotion] = useState<boolean>(() => {
    return localStorage.getItem("wba:reduceMotion") === "1";
  });

  const [cursor, setCursor] = useState<number>(0);
  const followTailRef = useRef<boolean>(true);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [speed, setSpeed] = useState<1 | 2 | 4>(2);

  useEffect(() => {
    if (!followTailRef.current) return;
    setCursor(events.length);
  }, [events.length]);

  useEffect(() => {
    if (!isPlaying) return;
    followTailRef.current = false;
    const intervalMs = Math.max(60, Math.floor(800 / speed));
    const timer = window.setInterval(() => {
      setCursor((current) => {
        const next = Math.min(current + 1, events.length);
        if (next >= events.length) {
          setIsPlaying(false);
          followTailRef.current = true;
        }
        return next;
      });
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [events.length, isPlaying, speed]);

  const view = useMemo(() => deriveMatchView(events, cursor), [events, cursor]);

  const hudExpanded = tab !== "match";

  const onStart = useCallback(async () => {
    const seed = seedInput.trim() ? Number(seedInput.trim()) : undefined;
    await startMatch({ tier, seed: Number.isFinite(seed) ? seed : undefined });
    followTailRef.current = true;
    setIsPlaying(false);
    setTab("match");
  }, [seedInput, startMatch, tier]);

  const setTabSafe = useCallback((next: AppTab) => {
    setTab(next);
    if (next !== "match") {
      setIsPlaying(false);
      followTailRef.current = false;
    }
  }, []);

  const goLive = useCallback(() => {
    setIsPlaying(false);
    followTailRef.current = true;
    setCursor(events.length);
  }, [events.length]);

  const stepBack = useCallback(() => {
    setIsPlaying(false);
    followTailRef.current = false;
    setCursor((c) => Math.max(0, c - 1));
  }, []);

  const stepForward = useCallback(() => {
    setIsPlaying(false);
    followTailRef.current = false;
    setCursor((c) => Math.min(events.length, c + 1));
  }, [events.length]);

  const onScrub = useCallback((value: number) => {
    setIsPlaying(false);
    followTailRef.current = value >= events.length;
    setCursor(value);
  }, [events.length]);

  const toggleReduceMotion = useCallback(() => {
    setReduceMotion((prev) => {
      const next = !prev;
      localStorage.setItem("wba:reduceMotion", next ? "1" : "0");
      return next;
    });
  }, []);

  return (
    <div className="shell">
      <ArenaScene
        activeSpeaker={
          view.activeSpeaker ? { teamId: view.activeSpeaker.teamId, role: view.activeSpeaker.role } : undefined
        }
        phase={view.phase}
        preset={cameraPreset}
        reduceMotion={reduceMotion}
        paused={hudExpanded}
      />

      <div className="hud">
        <header className="topBar">
          <div className="brand">
            <div className="brandTitle">Worldbuild Arena</div>
            <div className="brandMeta">
              <span className="pill">{connectionStatus}</span>
              <span className="mono">{matchId ? matchId.slice(0, 10) : "—"}</span>
              <span className="pill">{view.status}</span>
            </div>
          </div>

          <div className="topActions">
            <label className="field">
              <span className="fieldLabel">Tier</span>
              <select
                className="select"
                value={tier}
                onChange={(e) => setTier(Number(e.target.value) as 1 | 2 | 3)}
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </label>
            <label className="field">
              <span className="fieldLabel">Seed</span>
              <input
                className="input"
                inputMode="numeric"
                placeholder="random"
                value={seedInput}
                onChange={(e) => setSeedInput(e.target.value)}
              />
            </label>
            <button className="button" onClick={onStart}>
              Start match
            </button>
          </div>
        </header>

        {error ? <div className="error">{error}</div> : null}

        <nav className="tabBar">
          <button className={tab === "match" ? "tab active" : "tab"} onClick={() => setTabSafe("match")}>
            Match
          </button>
          <button className={tab === "canon" ? "tab active" : "tab"} onClick={() => setTabSafe("canon")}>
            Canon
          </button>
          <button className={tab === "artifacts" ? "tab active" : "tab"} onClick={() => setTabSafe("artifacts")}>
            Artifacts
          </button>
          <button className={tab === "judge" ? "tab active" : "tab"} onClick={() => setTabSafe("judge")}>
            Judge
          </button>
        </nav>

        <main className="content">
          <AnimatePresence mode="wait" initial={false}>
            {tab === "match" ? (
              <motion.div
                key="match"
                className="panelStack"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: reduceMotion ? 0 : 0.18 }}
              >
                <div className="row">
                  <div className="card">
                    <div className="cardTitle">Challenge</div>
                    {view.challenge ? (
                      <div className="kv">
                        <div>
                          <div className="kvKey">Biome</div>
                          <div className="kvValue">{view.challenge.biome_setting}</div>
                        </div>
                        <div>
                          <div className="kvKey">Inhabitants</div>
                          <div className="kvValue">{view.challenge.inhabitants}</div>
                        </div>
                        <div>
                          <div className="kvKey">Twist</div>
                          <div className="kvValue">{view.challenge.twist_constraint}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="muted">Waiting…</div>
                    )}
                  </div>

                  <div className="card">
                    <div className="cardTitle">Camera</div>
                    <div className="segmented">
                      <button
                        className={cameraPreset === "both" ? "seg active" : "seg"}
                        onClick={() => setCameraPreset("both")}
                      >
                        Both
                      </button>
                      <button
                        className={cameraPreset === "teamA" ? "seg active" : "seg"}
                        onClick={() => setCameraPreset("teamA")}
                      >
                        A
                      </button>
                      <button
                        className={cameraPreset === "teamB" ? "seg active" : "seg"}
                        onClick={() => setCameraPreset("teamB")}
                      >
                        B
                      </button>
                      <button
                        className={cameraPreset === "speaker" ? "seg active" : "seg"}
                        onClick={() => setCameraPreset("speaker")}
                        disabled={!view.activeSpeaker}
                      >
                        Speaker
                      </button>
                    </div>
                    <label className="toggleRow">
                      <input type="checkbox" checked={reduceMotion} onChange={toggleReduceMotion} />
                      <span>Reduce motion</span>
                    </label>
                  </div>
                </div>

                <div className="row">
                  <TeamCard teamId="A" view={view} />
                  <TeamCard teamId="B" view={view} />
                </div>

                <div className="card">
                  <div className="cardTitle">Timeline</div>
                  <div className="timelineTop">
                    <div className="mono">
                      {cursor}/{events.length} {view.lastEvent ? `· ${view.lastEvent.type}` : ""}
                    </div>
                    <div className="timelineButtons">
                      <button className="chip" onClick={stepBack} disabled={cursor <= 0}>
                        ◀
                      </button>
                      <button
                        className="chip"
                        onClick={() => {
                          setIsPlaying((p) => !p);
                        }}
                        disabled={events.length === 0}
                      >
                        {isPlaying ? "Pause" : "Play"}
                      </button>
                      <button className="chip" onClick={stepForward} disabled={cursor >= events.length}>
                        ▶
                      </button>
                      <button className="chip" onClick={goLive} disabled={cursor >= events.length}>
                        Live
                      </button>
                    </div>
                  </div>
                  <input
                    className="slider"
                    type="range"
                    min={0}
                    max={events.length}
                    value={cursor}
                    onChange={(e) => onScrub(Number(e.target.value))}
                  />
                  <div className="timelineBottom">
                    <div className="muted">Speed</div>
                    <div className="segmented">
                      <button className={speed === 1 ? "seg active" : "seg"} onClick={() => setSpeed(1)}>
                        1×
                      </button>
                      <button className={speed === 2 ? "seg active" : "seg"} onClick={() => setSpeed(2)}>
                        2×
                      </button>
                      <button className={speed === 4 ? "seg active" : "seg"} onClick={() => setSpeed(4)}>
                        4×
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : null}

            {tab === "canon" ? (
              <motion.div
                key="canon"
                className="panelStack"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: reduceMotion ? 0 : 0.18 }}
              >
                <CanonPanel view={view} />
              </motion.div>
            ) : null}

            {tab === "artifacts" ? (
              <motion.div
                key="artifacts"
                className="panelStack"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: reduceMotion ? 0 : 0.18 }}
              >
                <ArtifactsPanel view={view} />
              </motion.div>
            ) : null}

            {tab === "judge" ? (
              <motion.div
                key="judge"
                className="panelStack"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: reduceMotion ? 0 : 0.18 }}
              >
                <JudgePanel matchId={matchId} disabled={view.status !== "completed"} />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

function TeamCard({ teamId, view }: { teamId: TeamId; view: ReturnType<typeof deriveMatchView> }) {
  const team = view.teams[teamId];
  const title = teamId === "A" ? "Team A" : "Team B";
  return (
    <div className="card">
      <div className="cardTitle">{title}</div>
      <div className="mono">{team.canon?.world_name ?? "—"}</div>
      {team.lastTurn ? (
        <div className="turn">
          <div className="turnMeta">
            <span className="pill">{team.lastTurn.output.speaker_role}</span>
            <span className="pill">{team.lastTurn.output.turn_type}</span>
            <span className="muted">
              P{team.lastTurn.phase} · R{team.lastTurn.round}
            </span>
          </div>
          <details className="details">
            <summary className="summary">Last turn</summary>
            <div className="turnText">{team.lastTurn.output.content}</div>
          </details>
        </div>
      ) : (
        <div className="muted">Waiting…</div>
      )}

      {team.lastVote ? (
        <div className="voteRow">
          <span className="pill">Vote: {team.lastVote.result}</span>
          <span className="muted">
            A {team.lastVote.tally.ACCEPT} · M {team.lastVote.tally.AMEND} · R {team.lastVote.tally.REJECT}
          </span>
        </div>
      ) : null}

      {team.lastValidationFailure ? (
        <div className="warn">
          <div className="warnTitle">Validation</div>
          <ul className="warnList">
            {team.lastValidationFailure.errors.slice(0, 3).map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function CanonPanel({ view }: { view: ReturnType<typeof deriveMatchView> }) {
  const [teamId, setTeamId] = useState<TeamId>("A");
  const team = view.teams[teamId];
  return (
    <div className="card">
      <div className="cardTitle">Canon</div>
      <div className="segmented">
        <button className={teamId === "A" ? "seg active" : "seg"} onClick={() => setTeamId("A")}>
          Team A
        </button>
        <button className={teamId === "B" ? "seg active" : "seg"} onClick={() => setTeamId("B")}>
          Team B
        </button>
      </div>

      {team.canon ? (
        <div className="canon">
          <div className="canonHeader">
            <div className="canonTitle">{team.canon.world_name}</div>
            <div className="muted mono">{team.canonHash ? team.canonHash.slice(0, 12) : "—"}</div>
          </div>
          <div className="canonBlock">
            <div className="kvKey">Governing logic</div>
            <div className="kvValue">{team.canon.governing_logic}</div>
          </div>
          <div className="canonBlock">
            <div className="kvKey">Mood</div>
            <div className="kvValue">{team.canon.aesthetic_mood}</div>
          </div>
          <div className="canonBlock">
            <div className="kvKey">Landmarks</div>
            <ol className="canonList">
              {team.canon.landmarks.map((lm) => (
                <li key={lm.name}>
                  <div className="canonListTitle">{lm.name}</div>
                  <div className="muted">{lm.visual_key}</div>
                </li>
              ))}
            </ol>
          </div>
          <div className="canonBlock">
            <div className="kvKey">Inhabitants</div>
            <div className="kvValue">{team.canon.inhabitants.appearance}</div>
          </div>
          <div className="canonBlock">
            <div className="kvKey">Tension</div>
            <div className="kvValue">{team.canon.tension.conflict}</div>
            <div className="muted">{team.canon.tension.visual_manifestation}</div>
          </div>
          <details className="details">
            <summary className="summary">Hero image description</summary>
            <div className="turnText">{team.canon.hero_image_description}</div>
          </details>

          {team.lastPatch ? (
            <details className="details">
              <summary className="summary">Last patch</summary>
              <pre className="code">{JSON.stringify(team.lastPatch.patch, null, 2)}</pre>
            </details>
          ) : null}
        </div>
      ) : (
        <div className="muted">No canon yet.</div>
      )}
    </div>
  );
}

function ArtifactsPanel({ view }: { view: ReturnType<typeof deriveMatchView> }) {
  return (
    <div className="row">
      <PromptPackCard teamLabel="Team A" pack={view.teams.A.promptPack} />
      <PromptPackCard teamLabel="Team B" pack={view.teams.B.promptPack} />
    </div>
  );
}

function PromptPackCard({ teamLabel, pack }: { teamLabel: string; pack: PromptPack | undefined }) {
  return (
    <div className="card">
      <div className="cardTitle">{teamLabel}</div>
      {pack ? (
        <div className="promptPack">
          <PromptBlock title={pack.hero_image.title} aspectRatio={pack.hero_image.aspect_ratio} prompt={pack.hero_image.prompt} />
          {pack.landmark_triptych.map((p) => (
            <PromptBlock key={p.title} title={p.title} aspectRatio={p.aspect_ratio} prompt={p.prompt} />
          ))}
          <PromptBlock
            title={pack.inhabitant_portrait.title}
            aspectRatio={pack.inhabitant_portrait.aspect_ratio}
            prompt={pack.inhabitant_portrait.prompt}
          />
          <PromptBlock
            title={pack.tension_snapshot.title}
            aspectRatio={pack.tension_snapshot.aspect_ratio}
            prompt={pack.tension_snapshot.prompt}
          />
        </div>
      ) : (
        <div className="muted">Waiting for prompt packs…</div>
      )}
    </div>
  );
}

function PromptBlock({ title, aspectRatio, prompt }: { title: string; aspectRatio?: string; prompt: string }) {
  return (
    <details className="details">
      <summary className="summary">
        {title} {aspectRatio ? <span className="muted">· {aspectRatio}</span> : null}
      </summary>
      <div className="promptBody">
        <pre className="code">{prompt}</pre>
      </div>
    </details>
  );
}

function JudgePanel({ matchId, disabled }: { matchId: string | null; disabled: boolean }) {
  const [judge, setJudge] = useState<string>(() => localStorage.getItem("wba:judge") ?? "");
  const [loading, setLoading] = useState<boolean>(false);
  const [packageData, setPackageData] = useState<BlindPackageResponse | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, JudgingScores>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!matchId || disabled) return;
    setLoading(true);
    setSubmitError(null);
    fetch(blindJudgingUrl(matchId))
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return (await res.json()) as BlindPackageResponse;
      })
      .then((data) => {
        setPackageData(data);
        const initial: Record<string, JudgingScores> = {};
        for (const entry of data.entries) {
          initial[entry.blind_id] = scores[entry.blind_id] ?? {
            internal_coherence: 3,
            creative_ambition: 3,
            visual_fidelity: 3,
            artifact_quality: 3,
            process_quality: 3
          };
        }
        setScores(initial);
      })
      .catch((err) => setSubmitError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [disabled, matchId]);

  const submit = useCallback(
    async (blindId: string) => {
      if (!matchId) return;
      setSubmitError(null);
      if (!judge.trim()) {
        setSubmitError("Enter a judge name.");
        return;
      }
      localStorage.setItem("wba:judge", judge.trim());
      const response = await fetch(`${API_BASE_URL}/matches/${matchId}/judging/scores`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          judge: judge.trim(),
          blind_id: blindId,
          scores: scores[blindId],
          notes: notes[blindId] ?? null
        })
      });
      if (!response.ok) {
        setSubmitError(await response.text());
        return;
      }
    },
    [judge, matchId, notes, scores]
  );

  if (disabled) {
    return <div className="card"><div className="cardTitle">Judge</div><div className="muted">Match must be completed.</div></div>;
  }

  return (
    <div className="panelStack">
      <div className="card">
        <div className="cardTitle">Judge</div>
        <div className="muted">Blind scoring pack (WORLD-1 / WORLD-2). Reveal mapping is available on the API.</div>
        <label className="field">
          <span className="fieldLabel">Judge name</span>
          <input className="input" placeholder="your name" value={judge} onChange={(e) => setJudge(e.target.value)} />
        </label>
        {submitError ? <div className="error">{submitError}</div> : null}
      </div>

      {loading ? <div className="card"><div className="muted">Loading…</div></div> : null}

      {packageData ? (
        <div className="row">
          {packageData.entries.map((entry) => (
            <div className="card" key={entry.blind_id}>
              <div className="cardTitle">{entry.blind_id}</div>
              <div className="mono">{entry.canon.world_name}</div>
              <div className="muted">{entry.canon.governing_logic}</div>
              <div className="judgeGrid">
                {(
                  [
                    ["internal_coherence", "Internal Coherence"],
                    ["creative_ambition", "Creative Ambition"],
                    ["visual_fidelity", "Visual Fidelity"],
                    ["artifact_quality", "Artifact Quality"],
                    ["process_quality", "Process Quality"]
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="field">
                    <span className="fieldLabel">{label}</span>
                    <select
                      className="select"
                      value={scores[entry.blind_id]?.[key] ?? 3}
                      onChange={(e) =>
                        setScores((prev) => ({
                          ...prev,
                          [entry.blind_id]: { ...prev[entry.blind_id], [key]: Number(e.target.value) }
                        }))
                      }
                    >
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                      <option value={4}>4</option>
                      <option value={5}>5</option>
                    </select>
                  </label>
                ))}
              </div>
              <label className="field">
                <span className="fieldLabel">Notes</span>
                <textarea
                  className="textarea"
                  rows={3}
                  value={notes[entry.blind_id] ?? ""}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [entry.blind_id]: e.target.value }))}
                />
              </label>
              <button className="button" onClick={() => submit(entry.blind_id)}>
                Submit score
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
