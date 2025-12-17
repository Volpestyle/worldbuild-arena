import { useParams } from "react-router-dom";
import { useMatch } from "@/hooks/useMatch";
import { useReplay } from "@/hooks/useReplay";
import { AppShell } from "@/components/layout/AppShell";
import { ArenaScene } from "@/components/scene/ArenaScene";
import { HUD } from "@/components/hud/HUD";

export function MatchPage() {
  const { matchId } = useParams<{ matchId: string }>();

  if (!matchId) {
    return <div>Match ID required</div>;
  }

  return <MatchView matchId={matchId} />;
}

function MatchView({ matchId }: { matchId: string }) {
  const { isLoading, error } = useMatch(matchId);
  useReplay();

  if (error) {
    return (
      <AppShell>
        <div style={styles.error}>
          <h2>Error loading match</h2>
          <p>{error.message}</p>
        </div>
      </AppShell>
    );
  }

  if (isLoading) {
    return (
      <AppShell>
        <div style={styles.loading}>Loading match...</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div style={styles.container}>
        <ArenaScene />
        <HUD matchId={matchId} />
      </div>
    </AppShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "relative",
    width: "100%",
    height: "100%",
  },
  loading: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    color: "var(--color-text-muted)",
  },
  error: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    gap: "16px",
    color: "var(--color-contrarian)",
  },
};
