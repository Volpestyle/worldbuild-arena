import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { fetchArtifacts } from "@/api/client";
import type { ArtifactsResponse } from "@/api/types";
import { AppShell } from "@/components/layout/AppShell";
import { ArtifactGallery } from "@/components/gallery/ArtifactGallery";

export function GalleryPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const [artifacts, setArtifacts] = useState<ArtifactsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!matchId) return;

    fetchArtifacts(matchId)
      .then(setArtifacts)
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
          <h1 style={styles.title}>Artifact Gallery</h1>
        </header>

        {loading && <div style={styles.loading}>Loading artifacts...</div>}

        {error && (
          <div style={styles.error}>
            <p>Failed to load artifacts</p>
            <p style={styles.errorDetail}>{error.message}</p>
          </div>
        )}

        {artifacts && (
          <div style={styles.galleries}>
            <section style={styles.teamSection}>
              <h2 style={styles.teamTitle}>Team A</h2>
              <ArtifactGallery
                canon={artifacts.team_a.canon}
                promptPack={artifacts.team_a.prompt_pack}
              />
            </section>

            <section style={styles.teamSection}>
              <h2 style={styles.teamTitle}>Team B</h2>
              <ArtifactGallery
                canon={artifacts.team_b.canon}
                promptPack={artifacts.team_b.prompt_pack}
              />
            </section>
          </div>
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
  galleries: {
    display: "flex",
    flexDirection: "column",
    gap: "48px",
  },
  teamSection: {},
  teamTitle: {
    fontSize: "1.25rem",
    fontWeight: 600,
    marginBottom: "16px",
    paddingBottom: "8px",
    borderBottom: "1px solid var(--color-border)",
  },
};
