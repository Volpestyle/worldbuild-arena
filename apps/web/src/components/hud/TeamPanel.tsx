import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useShallow } from "zustand/react/shallow";
import type { TeamId } from "@wba/contracts";
import { useMatchStore } from "@/state/matchStore";
import { selectCurrentTurn, selectVoteResult } from "@/state/selectors";
import { ROLE_COLORS, ROLE_LABELS } from "@/styles/theme";

type TeamPanelProps = {
  teamId: TeamId;
};

export function TeamPanel({ teamId }: TeamPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const turn = useMatchStore(useShallow((s) => selectCurrentTurn(s, teamId)));
  const voteResult = useMatchStore(useShallow((s) => selectVoteResult(s, teamId)));

  const roleColor = turn ? ROLE_COLORS[turn.output.speaker_role] : undefined;

  return (
    <motion.div
      style={styles.container}
      layout
      initial={{ opacity: 0, x: teamId === "A" ? -20 : 20 }}
      animate={{ opacity: 1, x: 0 }}
    >
      {/* Header (always visible) */}
      <button style={styles.header} onClick={() => setExpanded(!expanded)}>
        <span style={styles.teamLabel}>Team {teamId}</span>
        {turn && (
          <>
            <span
              style={{
                ...styles.roleBadge,
                background: roleColor,
              }}
            >
              {ROLE_LABELS[turn.output.speaker_role]}
            </span>
            <span style={styles.turnType}>{turn.output.turn_type}</span>
          </>
        )}
        <span style={styles.expandIcon}>{expanded ? "−" : "+"}</span>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && turn && (
          <motion.div
            style={styles.content}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div style={styles.turnContent}>{turn.output.content}</div>

            {turn.output.vote && (
              <div style={styles.vote}>
                <span style={styles.voteLabel}>Vote:</span>
                <span
                  style={{
                    ...styles.voteChoice,
                    color:
                      turn.output.vote.choice === "ACCEPT"
                        ? "var(--color-synthesizer)"
                        : turn.output.vote.choice === "REJECT"
                          ? "var(--color-contrarian)"
                          : "var(--color-lorekeeper)",
                  }}
                >
                  {turn.output.vote.choice}
                </span>
                {turn.output.vote.amendment_summary && (
                  <span style={styles.amendment}>{turn.output.vote.amendment_summary}</span>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Vote tally */}
      {voteResult && (
        <div style={styles.voteTally}>
          <VoteTally tally={voteResult.tally} result={voteResult.result} />
        </div>
      )}
    </motion.div>
  );
}

type VoteTallyProps = {
  tally: Record<string, number>;
  result: string;
};

function VoteTally({ tally, result }: VoteTallyProps) {
  return (
    <div style={styles.tallyContainer}>
      <span style={styles.tallyItem}>
        <span style={{ color: "var(--color-synthesizer)" }}>A</span>:{tally.ACCEPT ?? 0}
      </span>
      <span style={styles.tallyItem}>
        <span style={{ color: "var(--color-lorekeeper)" }}>M</span>:{tally.AMEND ?? 0}
      </span>
      <span style={styles.tallyItem}>
        <span style={{ color: "var(--color-contrarian)" }}>R</span>:{tally.REJECT ?? 0}
      </span>
      <span style={styles.tallyResult}>→ {result}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: "100%",
    maxWidth: "320px",
    background: "rgba(10, 10, 15, 0.9)",
    borderRadius: "12px",
    overflow: "hidden",
    backdropFilter: "blur(12px)",
    border: "1px solid var(--color-border)",
  },
  header: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px",
    textAlign: "left",
  },
  teamLabel: {
    fontWeight: 700,
    fontSize: "0.875rem",
  },
  roleBadge: {
    padding: "2px 8px",
    borderRadius: "4px",
    fontSize: "0.625rem",
    fontWeight: 600,
    color: "white",
  },
  turnType: {
    fontSize: "0.625rem",
    color: "var(--color-text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  expandIcon: {
    marginLeft: "auto",
    fontSize: "1rem",
    color: "var(--color-text-muted)",
  },
  content: {
    overflow: "hidden",
  },
  turnContent: {
    padding: "0 12px 12px",
    fontSize: "0.8rem",
    lineHeight: 1.5,
    color: "var(--color-text)",
    maxHeight: "200px",
    overflowY: "auto",
  },
  vote: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 12px",
    background: "var(--color-bg-elevated)",
    fontSize: "0.75rem",
  },
  voteLabel: {
    color: "var(--color-text-muted)",
  },
  voteChoice: {
    fontWeight: 700,
  },
  amendment: {
    fontSize: "0.7rem",
    color: "var(--color-text-muted)",
    fontStyle: "italic",
  },
  voteTally: {
    padding: "8px 12px",
    borderTop: "1px solid var(--color-border)",
  },
  tallyContainer: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    fontSize: "0.75rem",
  },
  tallyItem: {
    fontFamily: "monospace",
  },
  tallyResult: {
    marginLeft: "auto",
    fontWeight: 600,
    color: "var(--color-accent)",
  },
};
