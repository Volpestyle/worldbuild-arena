import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchBlindJudgingPackage } from "@/api/client";
import type { BlindJudgingPackage } from "@/api/types";
import { AppShell } from "@/components/layout/AppShell";
import { BlindJudgingView } from "@/components/judging/BlindJudgingView";

export function JudgingPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const [blindPackage, setBlindPackage] = useState<BlindJudgingPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!matchId) return;

    fetchBlindJudgingPackage(matchId)
      .then(setBlindPackage)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [matchId]);

  if (!matchId) {
    return <div>Match ID required</div>;
  }

  return (
    <AppShell>
      <div style={styles.container}>
        <header style={styles.header}>
          <Link to={`/match/${matchId}`} style={styles.backLink}>
            &larr; Back to Match
          </Link>
          <h1 style={styles.title}>Blind Judging</h1>
          <p style={styles.subtitle}>
            Score each world without knowing which team created it
          </p>
        </header>

        {loading && <div style={styles.loading}>Loading judging package...</div>}

        {error && (
          <div style={styles.error}>
            <p>Failed to load judging package</p>
            <p style={styles.errorDetail}>{error.message}</p>
          </div>
        )}

        {blindPackage && (
          <BlindJudgingView matchId={matchId} blindPackage={blindPackage} />
        )}
      </div>
    </AppShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: "100%",
    overflow: "auto",
    padding: "max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))",
  },
  header: {
    marginBottom: "24px",
  },
  backLink: {
    color: "var(--color-text-muted)",
    textDecoration: "none",
    fontSize: "0.875rem",
    display: "inline-block",
    marginBottom: "8px",
  },
  title: {
    fontSize: "1.5rem",
    fontWeight: 700,
    marginBottom: "4px",
  },
  subtitle: {
    color: "var(--color-text-muted)",
    fontSize: "0.875rem",
  },
  loading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "64px",
    color: "var(--color-text-muted)",
  },
  error: {
    textAlign: "center",
    padding: "64px",
    color: "var(--color-contrarian)",
  },
  errorDetail: {
    color: "var(--color-text-muted)",
    fontSize: "0.875rem",
    marginTop: "8px",
  },
};
