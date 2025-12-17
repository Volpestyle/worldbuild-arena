import { useState } from "react";
import { submitJudgingScore } from "@/api/client";
import type { JudgingScores } from "@/api/types";

type ScoringFormProps = {
  matchId: string;
  blindId: string;
  onSubmitted: () => void;
  onCancel: () => void;
};

const CATEGORIES = [
  {
    key: "internal_coherence" as const,
    label: "Internal Coherence",
    weight: 25,
    description: "Do all elements follow from the governing logic?",
  },
  {
    key: "creative_ambition" as const,
    label: "Creative Ambition",
    weight: 20,
    description: "Is it genuinely novel, or derivative?",
  },
  {
    key: "visual_fidelity" as const,
    label: "Visual Fidelity",
    weight: 20,
    description: "Do images match the spec?",
  },
  {
    key: "artifact_quality" as const,
    label: "Artifact Quality",
    weight: 20,
    description: "Are the images compelling on their own?",
  },
  {
    key: "process_quality" as const,
    label: "Process Quality",
    weight: 15,
    description: "Was the debate productive? Did they resolve well?",
  },
];

const SCORE_LABELS: Record<number, string> = {
  1: "Failed",
  2: "Weak",
  3: "Competent",
  4: "Strong",
  5: "Exceptional",
};

export function ScoringForm({
  matchId,
  blindId,
  onSubmitted,
  onCancel,
}: ScoringFormProps) {
  const [judge, setJudge] = useState("");
  const [scores, setScores] = useState<JudgingScores>({
    internal_coherence: 3,
    creative_ambition: 3,
    visual_fidelity: 3,
    artifact_quality: 3,
    process_quality: 3,
  });
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalWeightedScore = CATEGORIES.reduce(
    (sum, cat) => sum + (scores[cat.key] * cat.weight) / 100,
    0
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!judge.trim()) {
      setError("Please enter your name");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await submitJudgingScore(matchId, {
        judge: judge.trim(),
        blind_id: blindId,
        scores,
        notes: notes.trim() || undefined,
      });
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit score");
    } finally {
      setSubmitting(false);
    }
  };

  const updateScore = (key: keyof JudgingScores, value: number) => {
    setScores((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <form style={styles.form} onSubmit={handleSubmit}>
      {/* Judge name */}
      <div style={styles.field}>
        <label style={styles.label}>Judge Name</label>
        <input
          type="text"
          value={judge}
          onChange={(e) => setJudge(e.target.value)}
          placeholder="Enter your name"
          style={styles.input}
          required
        />
      </div>

      {/* Score categories */}
      <div style={styles.categories}>
        {CATEGORIES.map((cat) => (
          <div key={cat.key} style={styles.category}>
            <div style={styles.categoryHeader}>
              <span style={styles.categoryLabel}>{cat.label}</span>
              <span style={styles.categoryWeight}>({cat.weight}%)</span>
            </div>
            <p style={styles.categoryDesc}>{cat.description}</p>
            <div style={styles.scoreButtons}>
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  style={{
                    ...styles.scoreButton,
                    ...(scores[cat.key] === value ? styles.scoreButtonActive : {}),
                  }}
                  onClick={() => updateScore(cat.key, value)}
                  title={SCORE_LABELS[value]}
                >
                  {value}
                </button>
              ))}
            </div>
            <span style={styles.scoreLabel}>{SCORE_LABELS[scores[cat.key]]}</span>
          </div>
        ))}
      </div>

      {/* Total score */}
      <div style={styles.totalSection}>
        <span style={styles.totalLabel}>Weighted Total</span>
        <span style={styles.totalValue}>{totalWeightedScore.toFixed(2)} / 5.00</span>
      </div>

      {/* Notes */}
      <div style={styles.field}>
        <label style={styles.label}>Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any additional comments..."
          style={styles.textarea}
          rows={3}
        />
      </div>

      {/* Error */}
      {error && <p style={styles.error}>{error}</p>}

      {/* Actions */}
      <div style={styles.actions}>
        <button type="button" style={styles.cancelButton} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" style={styles.submitButton} disabled={submitting}>
          {submitting ? "Submitting..." : "Submit Score"}
        </button>
      </div>
    </form>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: {
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  label: {
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "var(--color-text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  input: {
    padding: "10px 12px",
    background: "var(--color-bg)",
    border: "1px solid var(--color-border)",
    borderRadius: "6px",
    color: "var(--color-text)",
    fontSize: "0.875rem",
  },
  textarea: {
    padding: "10px 12px",
    background: "var(--color-bg)",
    border: "1px solid var(--color-border)",
    borderRadius: "6px",
    color: "var(--color-text)",
    fontSize: "0.875rem",
    resize: "vertical",
  },
  categories: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  category: {
    padding: "12px",
    background: "var(--color-bg)",
    borderRadius: "8px",
  },
  categoryHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "4px",
  },
  categoryLabel: {
    fontSize: "0.875rem",
    fontWeight: 600,
  },
  categoryWeight: {
    fontSize: "0.75rem",
    color: "var(--color-text-muted)",
  },
  categoryDesc: {
    fontSize: "0.75rem",
    color: "var(--color-text-muted)",
    marginBottom: "12px",
  },
  scoreButtons: {
    display: "flex",
    gap: "8px",
    marginBottom: "8px",
  },
  scoreButton: {
    flex: 1,
    padding: "10px",
    borderRadius: "6px",
    fontSize: "0.875rem",
    fontWeight: 600,
    background: "var(--color-bg-elevated)",
    color: "var(--color-text-muted)",
    border: "1px solid var(--color-border)",
    transition: "all 0.15s ease",
  },
  scoreButtonActive: {
    background: "var(--color-accent)",
    color: "white",
    border: "1px solid var(--color-accent)",
  },
  scoreLabel: {
    fontSize: "0.75rem",
    color: "var(--color-accent)",
    fontStyle: "italic",
  },
  totalSection: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px",
    background: "var(--color-bg-elevated)",
    borderRadius: "8px",
    border: "1px solid var(--color-border)",
  },
  totalLabel: {
    fontSize: "0.875rem",
    fontWeight: 600,
  },
  totalValue: {
    fontSize: "1.25rem",
    fontWeight: 700,
    color: "var(--color-accent)",
  },
  error: {
    color: "var(--color-contrarian)",
    fontSize: "0.875rem",
    padding: "12px",
    background: "rgba(231, 76, 60, 0.1)",
    borderRadius: "6px",
  },
  actions: {
    display: "flex",
    gap: "12px",
  },
  cancelButton: {
    flex: 1,
    padding: "12px",
    borderRadius: "8px",
    fontSize: "0.875rem",
    fontWeight: 600,
    background: "var(--color-bg-elevated)",
    color: "var(--color-text-muted)",
    border: "1px solid var(--color-border)",
  },
  submitButton: {
    flex: 2,
    padding: "12px",
    borderRadius: "8px",
    fontSize: "0.875rem",
    fontWeight: 600,
    background: "var(--color-accent)",
    color: "white",
  },
};
