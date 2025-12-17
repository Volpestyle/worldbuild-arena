import { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { useShallow } from "zustand/react/shallow";
import { useMatchStore } from "@/state/matchStore";
import { selectCurrentPhase, selectActiveSpeaker } from "@/state/selectors";
import { usePerformance } from "@/hooks/usePerformance";
import { Environment } from "./Environment";
import { SceneCamera } from "./Camera";
import { Table } from "./Table";
import { Avatar } from "./Avatar";
import { ROLE_SEAT_INDEX } from "@/styles/theme";
import type { Role, TeamId } from "@wba/contracts";

const ROLES: Role[] = ["ARCHITECT", "LOREKEEPER", "CONTRARIAN", "SYNTHESIZER"];

export function ArenaScene() {
  const { dpr, should3DPause } = usePerformance();
  const phaseInfo = useMatchStore(useShallow(selectCurrentPhase));
  const activeSpeaker = useMatchStore(useShallow(selectActiveSpeaker));
  const [cameraPreset, setCameraPreset] = useState<"both" | "team_a" | "team_b">("both");

  const phase = phaseInfo?.phase ?? 0;

  const isRoleActive = (teamId: TeamId, role: Role): boolean => {
    if (!activeSpeaker) return false;
    return activeSpeaker.teamId === teamId && activeSpeaker.role === role;
  };

  return (
    <div style={styles.container}>
      <Canvas
        dpr={dpr}
        camera={{ position: [0, 8, 14], fov: 50 }}
        frameloop={should3DPause ? "demand" : "always"}
        style={styles.canvas}
      >
        <Suspense fallback={null}>
          <Environment phase={phase} />
          <SceneCamera preset={cameraPreset} />

          {/* Team A Table (left side) */}
          <group position={[-4, 0, 0]}>
            <Table teamId="A" />
            {ROLES.map((role) => (
              <Avatar
                key={`A-${role}`}
                role={role}
                teamId="A"
                seatIndex={ROLE_SEAT_INDEX[role]}
                isActive={isRoleActive("A", role)}
              />
            ))}
          </group>

          {/* Team B Table (right side) */}
          <group position={[4, 0, 0]}>
            <Table teamId="B" />
            {ROLES.map((role) => (
              <Avatar
                key={`B-${role}`}
                role={role}
                teamId="B"
                seatIndex={ROLE_SEAT_INDEX[role]}
                isActive={isRoleActive("B", role)}
              />
            ))}
          </group>

          {/* Floor */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
            <planeGeometry args={[30, 30]} />
            <meshStandardMaterial color="#1a1a24" />
          </mesh>
        </Suspense>
      </Canvas>

      {/* Camera preset buttons */}
      <div style={styles.cameraControls}>
        <button
          style={{
            ...styles.cameraButton,
            ...(cameraPreset === "both" ? styles.cameraButtonActive : {}),
          }}
          onClick={() => setCameraPreset("both")}
        >
          Both
        </button>
        <button
          style={{
            ...styles.cameraButton,
            ...(cameraPreset === "team_a" ? styles.cameraButtonActive : {}),
          }}
          onClick={() => setCameraPreset("team_a")}
        >
          Team A
        </button>
        <button
          style={{
            ...styles.cameraButton,
            ...(cameraPreset === "team_b" ? styles.cameraButtonActive : {}),
          }}
          onClick={() => setCameraPreset("team_b")}
        >
          Team B
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "absolute",
    inset: 0,
    zIndex: 0,
  },
  canvas: {
    touchAction: "none",
  },
  cameraControls: {
    position: "absolute",
    bottom: "calc(160px + env(safe-area-inset-bottom, 0px))",
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    gap: "4px",
    padding: "4px",
    background: "rgba(10, 10, 15, 0.8)",
    borderRadius: "8px",
    backdropFilter: "blur(8px)",
  },
  cameraButton: {
    padding: "8px 12px",
    borderRadius: "6px",
    fontSize: "0.75rem",
    fontWeight: 500,
    color: "var(--color-text-muted)",
    transition: "all 0.15s ease",
  },
  cameraButtonActive: {
    background: "var(--color-accent)",
    color: "white",
  },
};
