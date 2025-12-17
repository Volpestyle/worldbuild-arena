import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createMatch, fetchMatches } from "@/api/client";
import type { MatchSummary } from "@/api/types";

export function HomePage() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [tier, setTier] = useState<1 | 2 | 3>(1);

  const loadMatches = async () => {
    setLoading(true);
    try {
      const data = await fetchMatches();
      setMatches(data);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const match = await createMatch(undefined, tier);
      navigate(`/match/${match.match_id}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Worldbuild Arena</h1>
        <p style={styles.subtitle}>
          AI teams compete to create the best fictional worlds
        </p>
      </header>

      <section style={styles.createSection}>
        <h2 style={styles.sectionTitle}>Start New Match</h2>
        <div style={styles.tierSelector}>
          <label style={styles.label}>Challenge Tier:</label>
          <select
            value={tier}
            onChange={(e) => setTier(Number(e.target.value) as 1 | 2 | 3)}
            style={styles.select}
          >
            <option value={1}>Tier 1 (Easy)</option>
            <option value={2}>Tier 2 (Medium)</option>
            <option value={3}>Tier 3 (Hard)</option>
          </select>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          style={styles.createButton}
        >
          {creating ? "Creating..." : "Create Match"}
        </button>
      </section>

      <section style={styles.matchesSection}>
        <div style={styles.matchesHeader}>
          <h2 style={styles.sectionTitle}>Recent Matches</h2>
          <button onClick={loadMatches} disabled={loading} style={styles.refreshButton}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>
        {matches.length === 0 ? (
          <p style={styles.emptyText}>No matches yet. Create one to get started!</p>
        ) : (
          <ul style={styles.matchList}>
            {matches.map((match) => (
              <li key={match.match_id} style={styles.matchItem}>
                <button
                  onClick={() => navigate(`/match/${match.match_id}`)}
                  style={styles.matchButton}
                >
                  <span style={styles.matchId}>{match.match_id}</span>
                  <span style={styles.matchStatus}>{match.status}</span>
                  <span style={styles.matchTier}>Tier {match.tier}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100%",
    padding: "max(24px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))",
    display: "flex",
    flexDirection: "column",
    gap: "32px",
  },
  header: {
    textAlign: "center",
    paddingTop: "16px",
  },
  title: {
    fontSize: "2rem",
    fontWeight: 700,
    marginBottom: "8px",
  },
  subtitle: {
    color: "var(--color-text-muted)",
    fontSize: "1rem",
  },
  createSection: {
    background: "var(--color-bg-panel)",
    borderRadius: "12px",
    padding: "20px",
  },
  sectionTitle: {
    fontSize: "1.125rem",
    fontWeight: 600,
    marginBottom: "16px",
  },
  tierSelector: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "16px",
  },
  label: {
    color: "var(--color-text-muted)",
  },
  select: {
    flex: 1,
    maxWidth: "200px",
  },
  createButton: {
    width: "100%",
    padding: "12px",
    background: "var(--color-accent)",
    color: "white",
    borderRadius: "8px",
    fontWeight: 600,
    fontSize: "1rem",
  },
  matchesSection: {
    flex: 1,
  },
  matchesHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  refreshButton: {
    padding: "8px 16px",
    background: "var(--color-bg-elevated)",
    borderRadius: "6px",
    fontSize: "0.875rem",
  },
  emptyText: {
    color: "var(--color-text-muted)",
    textAlign: "center",
    padding: "32px",
  },
  matchList: {
    listStyle: "none",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  matchItem: {},
  matchButton: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "16px",
    background: "var(--color-bg-panel)",
    borderRadius: "8px",
    textAlign: "left",
  },
  matchId: {
    flex: 1,
    fontFamily: "monospace",
    fontSize: "0.875rem",
  },
  matchStatus: {
    padding: "4px 8px",
    background: "var(--color-bg-elevated)",
    borderRadius: "4px",
    fontSize: "0.75rem",
    textTransform: "uppercase",
  },
  matchTier: {
    color: "var(--color-text-muted)",
    fontSize: "0.875rem",
  },
};
