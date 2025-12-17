import { Link } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { useMatchStore } from "@/state/matchStore";
import { selectChallenge, selectCurrentPhase, selectMatchStatus } from "@/state/selectors";
import { PHASE_NAMES } from "@/styles/theme";

type TopBarProps = {
  matchId: string;
};

export function TopBar({ matchId }: TopBarProps) {
  const matchDetail = useMatchStore((s) => s.matchDetail);
  const challenge = useMatchStore(useShallow(selectChallenge));
  const phaseInfo = useMatchStore(useShallow(selectCurrentPhase));
  const status = useMatchStore(selectMatchStatus);
  const isConnected = useMatchStore((s) => s.isConnected);
  const isLive = useMatchStore((s) => s.isLive);

  const phaseName = phaseInfo ? PHASE_NAMES[phaseInfo.phase] ?? `Phase ${phaseInfo.phase}` : "Loading...";

  return (
    <header style={styles.container}>
      <div style={styles.left}>
        <Link to="/" style={styles.homeLink}>
          &larr;
        </Link>
        <span style={styles.matchId}>{matchId.slice(0, 8)}</span>
        {matchDetail && <span style={styles.tier}>T{matchDetail.tier}</span>}
      </div>

      <div style={styles.center}>
        {challenge && (
          <div style={styles.challenge}>
            <span style={styles.biome}>{challenge.biome_setting}</span>
          </div>
        )}
      </div>

      <div style={styles.right}>
        <div style={styles.phaseInfo}>
          <span style={styles.phaseName}>{phaseName}</span>
          {phaseInfo && phaseInfo.roundCount > 0 && (
            <span style={styles.round}>
              R{phaseInfo.round + 1}/{phaseInfo.roundCount}
            </span>
          )}
        </div>
        <div style={styles.status}>
          <span
            style={{
              ...styles.statusDot,
              background:
                status === "completed"
                  ? "var(--color-synthesizer)"
                  : status === "failed"
                    ? "var(--color-contrarian)"
                    : isConnected
                      ? "var(--color-architect)"
                      : "var(--color-text-muted)",
            }}
          />
          {isLive && status === "running" && <span style={styles.liveLabel}>LIVE</span>}
        </div>
      </div>
    </header>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "max(8px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) 8px max(12px, env(safe-area-inset-left))",
    background: "rgba(10, 10, 15, 0.9)",
    backdropFilter: "blur(12px)",
    borderBottom: "1px solid var(--color-border)",
    zIndex: 100,
  },
  left: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  homeLink: {
    color: "var(--color-text-muted)",
    textDecoration: "none",
    fontSize: "1.25rem",
    padding: "4px 8px",
  },
  matchId: {
    fontFamily: "monospace",
    fontSize: "0.75rem",
    color: "var(--color-text-muted)",
  },
  tier: {
    padding: "2px 6px",
    background: "var(--color-bg-elevated)",
    borderRadius: "4px",
    fontSize: "0.625rem",
    fontWeight: 600,
    color: "var(--color-accent)",
  },
  center: {
    flex: 1,
    display: "flex",
    justifyContent: "center",
    overflow: "hidden",
  },
  challenge: {
    maxWidth: "200px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  biome: {
    fontSize: "0.8rem",
    fontWeight: 500,
  },
  right: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  phaseInfo: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
  },
  phaseName: {
    fontSize: "0.75rem",
    fontWeight: 600,
  },
  round: {
    fontSize: "0.625rem",
    color: "var(--color-text-muted)",
  },
  status: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  statusDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
  },
  liveLabel: {
    fontSize: "0.625rem",
    fontWeight: 700,
    color: "var(--color-contrarian)",
    letterSpacing: "0.5px",
  },
};
