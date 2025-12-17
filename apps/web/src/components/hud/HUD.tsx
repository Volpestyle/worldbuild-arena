import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useViewport } from "@/hooks/useViewport";
import { useMatchStore } from "@/state/matchStore";
import { selectMatchStatus } from "@/state/selectors";
import { TopBar } from "@/components/layout/TopBar";
import { TeamPanel } from "./TeamPanel";
import { CanonPanel } from "./CanonPanel";
import { TimelineControls } from "./TimelineControls";
import { SwipeContainer } from "@/components/shared/SwipeContainer";

type HUDProps = {
  matchId: string;
};

export function HUD({ matchId }: HUDProps) {
  const { isMobile } = useViewport();
  const [showCanon, setShowCanon] = useState(false);
  const status = useMatchStore(selectMatchStatus);

  return (
    <div style={styles.container}>
      <TopBar matchId={matchId} />

      {/* Team panels */}
      <div style={styles.panels}>
        {isMobile ? (
          <SwipeContainer>
            <TeamPanel teamId="A" />
            <TeamPanel teamId="B" />
          </SwipeContainer>
        ) : (
          <>
            <TeamPanel teamId="A" />
            <div style={styles.spacer} />
            <TeamPanel teamId="B" />
          </>
        )}
      </div>

      {/* Bottom controls */}
      <div style={styles.bottom}>
        {/* Canon toggle button */}
        <button style={styles.canonToggle} onClick={() => setShowCanon(!showCanon)}>
          {showCanon ? "Hide Canon" : "Show Canon"}
        </button>

        {/* Navigation links when match is complete */}
        {status === "completed" && (
          <div style={styles.completedLinks}>
            <Link to={`/match/${matchId}/gallery`} style={styles.link}>
              Gallery
            </Link>
            <Link to={`/match/${matchId}/judging`} style={styles.link}>
              Judge
            </Link>
          </div>
        )}

        <TimelineControls />
      </div>

      {/* Canon panel (modal-like on mobile) */}
      {showCanon && (
        <motion.div
          style={styles.canonContainer}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
        >
          <CanonPanel onClose={() => setShowCanon(false)} />
        </motion.div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    pointerEvents: "none",
    zIndex: 10,
  },
  panels: {
    flex: 1,
    display: "flex",
    alignItems: "flex-start",
    padding: "8px",
    gap: "8px",
    overflow: "hidden",
    pointerEvents: "auto",
  },
  spacer: {
    flex: 1,
  },
  bottom: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "8px",
    paddingBottom: "max(8px, env(safe-area-inset-bottom))",
    pointerEvents: "auto",
  },
  canonToggle: {
    alignSelf: "center",
    padding: "8px 16px",
    background: "rgba(10, 10, 15, 0.9)",
    borderRadius: "8px",
    fontSize: "0.75rem",
    fontWeight: 500,
    color: "var(--color-text-muted)",
    backdropFilter: "blur(8px)",
    border: "1px solid var(--color-border)",
  },
  completedLinks: {
    display: "flex",
    justifyContent: "center",
    gap: "12px",
  },
  link: {
    padding: "8px 16px",
    background: "var(--color-accent)",
    color: "white",
    borderRadius: "8px",
    fontSize: "0.875rem",
    fontWeight: 600,
    textDecoration: "none",
  },
  canonContainer: {
    position: "absolute",
    bottom: "120px",
    left: "8px",
    right: "8px",
    maxHeight: "50vh",
    pointerEvents: "auto",
  },
};
