import { useState } from "react";
import { motion } from "framer-motion";
import type { BlindJudgingPackage, BlindRevealMapping } from "@/api/types";
import { revealBlindMapping } from "@/api/client";
import { ScoringForm } from "./ScoringForm";
import { ArtifactGallery } from "@/components/gallery/ArtifactGallery";
import { CollapsiblePanel } from "@/components/shared/CollapsiblePanel";

type BlindJudgingViewProps = {
  matchId: string;
  blindPackage: BlindJudgingPackage;
};

export function BlindJudgingView({ matchId, blindPackage }: BlindJudgingViewProps) {
  const [selectedEntry, setSelectedEntry] = useState<string | null>(null);
  const [submittedScores, setSubmittedScores] = useState<Set<string>>(new Set());
  const [revealed, setRevealed] = useState<BlindRevealMapping | null>(null);
  const [revealing, setRevealing] = useState(false);

  const allScored = blindPackage.entries.every((e) =>
    submittedScores.has(e.blind_id)
  );

  const handleReveal = async () => {
    setRevealing(true);
    try {
      const mapping = await revealBlindMapping(matchId);
      setRevealed(mapping);
    } finally {
      setRevealing(false);
    }
  };

  const handleScoreSubmitted = (blindId: string) => {
    setSubmittedScores((prev) => new Set([...prev, blindId]));
    setSelectedEntry(null);
  };

  return (
    <div style={styles.container}>
      {/* Entry cards */}
      <div style={styles.entries}>
        {blindPackage.entries.map((entry) => (
          <div key={entry.blind_id} style={styles.entryCard}>
            <div style={styles.entryHeader}>
              <h2 style={styles.entryTitle}>{entry.blind_id}</h2>
              {submittedScores.has(entry.blind_id) && (
                <span style={styles.scoredBadge}>✓ Scored</span>
              )}
              {revealed && (
                <span style={styles.revealedBadge}>
                  Team {revealed[entry.blind_id]}
                </span>
              )}
            </div>

            {/* Canon summary */}
            <CollapsiblePanel title="World Details" defaultExpanded={false}>
              <div style={styles.canonSummary}>
                <p>
                  <strong>{entry.canon.world_name}</strong>
                </p>
                <p style={styles.governingLogic}>{entry.canon.governing_logic}</p>
                <p style={styles.mood}>{entry.canon.aesthetic_mood}</p>
              </div>
            </CollapsiblePanel>

            {/* Artifacts */}
            <CollapsiblePanel
              title="Artifacts"
              badge={entry.prompt_pack ? "6" : "0"}
              defaultExpanded={false}
            >
              <ArtifactGallery
                canon={entry.canon}
                promptPack={entry.prompt_pack}
              />
            </CollapsiblePanel>

            {/* Score button */}
            <button
              style={styles.scoreButton}
              onClick={() => setSelectedEntry(entry.blind_id)}
            >
              {submittedScores.has(entry.blind_id) ? "Edit Score" : "Score This World"}
            </button>
          </div>
        ))}
      </div>

      {/* Reveal section */}
      {allScored && !revealed && (
        <motion.div
          style={styles.revealSection}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p style={styles.revealText}>
            You've scored both worlds. Ready to see which team created which?
          </p>
          <button
            style={styles.revealButton}
            onClick={handleReveal}
            disabled={revealing}
          >
            {revealing ? "Revealing..." : "Reveal Team Identities"}
          </button>
        </motion.div>
      )}

      {/* Reveal results */}
      {revealed && (
        <motion.div
          style={styles.revealResults}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <h3 style={styles.resultsTitle}>Results Revealed!</h3>
          <div style={styles.mappings}>
            {Object.entries(revealed).map(([blindId, teamId]) => (
              <div key={blindId} style={styles.mapping}>
                <span style={styles.mappingBlindId}>{blindId}</span>
                <span style={styles.mappingArrow}>is</span>
                <span style={styles.mappingTeamId}>Team {teamId}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Scoring modal */}
      {selectedEntry && (
        <div style={styles.modal}>
          <div style={styles.modalBackdrop} onClick={() => setSelectedEntry(null)} />
          <motion.div
            style={styles.modalContent}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Score {selectedEntry}</h3>
              <button
                style={styles.modalClose}
                onClick={() => setSelectedEntry(null)}
              >
                ×
              </button>
            </div>
            <ScoringForm
              matchId={matchId}
              blindId={selectedEntry}
              onSubmitted={() => handleScoreSubmitted(selectedEntry)}
              onCancel={() => setSelectedEntry(null)}
            />
          </motion.div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  entries: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },
  entryCard: {
    background: "var(--color-bg-panel)",
    borderRadius: "12px",
    padding: "20px",
    border: "1px solid var(--color-border)",
  },
  entryHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "16px",
  },
  entryTitle: {
    fontSize: "1.25rem",
    fontWeight: 700,
    margin: 0,
  },
  scoredBadge: {
    padding: "4px 8px",
    background: "var(--color-synthesizer)",
    color: "white",
    borderRadius: "4px",
    fontSize: "0.75rem",
    fontWeight: 600,
  },
  revealedBadge: {
    padding: "4px 8px",
    background: "var(--color-accent)",
    color: "white",
    borderRadius: "4px",
    fontSize: "0.75rem",
    fontWeight: 600,
  },
  canonSummary: {
    fontSize: "0.875rem",
    lineHeight: 1.6,
  },
  governingLogic: {
    color: "var(--color-text-muted)",
    fontStyle: "italic",
    marginTop: "8px",
  },
  mood: {
    color: "var(--color-lorekeeper)",
    marginTop: "4px",
  },
  scoreButton: {
    marginTop: "16px",
    width: "100%",
    padding: "12px",
    background: "var(--color-accent)",
    color: "white",
    borderRadius: "8px",
    fontSize: "0.875rem",
    fontWeight: 600,
  },
  revealSection: {
    textAlign: "center",
    padding: "24px",
    background: "var(--color-bg-panel)",
    borderRadius: "12px",
    border: "1px solid var(--color-border)",
  },
  revealText: {
    marginBottom: "16px",
    color: "var(--color-text-muted)",
  },
  revealButton: {
    padding: "12px 24px",
    background: "var(--color-lorekeeper)",
    color: "white",
    borderRadius: "8px",
    fontSize: "0.875rem",
    fontWeight: 600,
  },
  revealResults: {
    textAlign: "center",
    padding: "24px",
    background: "linear-gradient(135deg, var(--color-bg-panel), var(--color-bg-elevated))",
    borderRadius: "12px",
    border: "1px solid var(--color-accent)",
  },
  resultsTitle: {
    fontSize: "1.25rem",
    fontWeight: 700,
    marginBottom: "16px",
    color: "var(--color-accent)",
  },
  mappings: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  mapping: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "16px",
    fontSize: "1.125rem",
  },
  mappingBlindId: {
    fontWeight: 600,
  },
  mappingArrow: {
    color: "var(--color-text-muted)",
  },
  mappingTeamId: {
    fontWeight: 700,
    color: "var(--color-synthesizer)",
  },
  modal: {
    position: "fixed",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px",
    zIndex: 1000,
  },
  modalBackdrop: {
    position: "absolute",
    inset: 0,
    background: "rgba(0, 0, 0, 0.8)",
  },
  modalContent: {
    position: "relative",
    width: "100%",
    maxWidth: "500px",
    maxHeight: "90vh",
    overflow: "auto",
    background: "var(--color-bg-panel)",
    borderRadius: "16px",
    border: "1px solid var(--color-border)",
  },
  modalHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px",
    borderBottom: "1px solid var(--color-border)",
  },
  modalTitle: {
    fontSize: "1.125rem",
    fontWeight: 600,
    margin: 0,
  },
  modalClose: {
    fontSize: "1.5rem",
    color: "var(--color-text-muted)",
    padding: "4px 8px",
  },
};
