import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import type { Role, TeamId } from "@wba/contracts";

type CameraPreset = "both" | "teamA" | "teamB" | "speaker";

export type ArenaSceneProps = {
  activeSpeaker: { teamId: TeamId; role: Role } | undefined;
  phase: number | undefined;
  preset: CameraPreset;
  reduceMotion: boolean;
  paused: boolean;
};

export function ArenaScene({ activeSpeaker, phase, preset, reduceMotion, paused }: ArenaSceneProps) {
  return (
    <div className="scene">
      <Canvas
        dpr={reduceMotion ? 1 : [1, 2]}
        camera={{ position: [0, 3.2, 8], fov: 48, near: 0.1, far: 100 }}
        frameloop={paused ? "demand" : "always"}
      >
        <color attach="background" args={["#070a10"]} />
        <fog attach="fog" args={["#070a10", 10, 24]} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[6, 8, 3]} intensity={1.1} color={"#d7e2ff"} />
        <Arena phase={phase} activeSpeaker={activeSpeaker} />
        <CameraRig preset={preset} activeSpeaker={activeSpeaker} reduceMotion={reduceMotion} paused={paused} />
        <OrbitControls
          enablePan={false}
          enableDamping={!reduceMotion}
          dampingFactor={0.08}
          minDistance={3.5}
          maxDistance={12}
          minPolarAngle={0.35}
          maxPolarAngle={1.35}
        />
      </Canvas>
    </div>
  );
}

function phaseAccent(phase: number | undefined): THREE.Color {
  if (phase === 1) return new THREE.Color("#66b1ff");
  if (phase === 2) return new THREE.Color("#7ee787");
  if (phase === 3) return new THREE.Color("#ffb86c");
  if (phase === 4) return new THREE.Color("#c084fc");
  if (phase === 5) return new THREE.Color("#22d3ee");
  return new THREE.Color("#9aa4b2");
}

function Arena({
  phase,
  activeSpeaker
}: {
  phase: number | undefined;
  activeSpeaker: { teamId: TeamId; role: Role } | undefined;
}) {
  const accent = useMemo(() => phaseAccent(phase), [phase]);
  const rim = useRef<THREE.DirectionalLight>(null);

  useFrame((_state, delta) => {
    if (!rim.current) return;
    const t = Math.min(1, delta * 2.2);
    rim.current.color.lerp(accent, t);
  });

  return (
    <group>
      <directionalLight ref={rim} position={[-6, 6, -3]} intensity={0.65} color={accent} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.52, 0]} receiveShadow>
        <circleGeometry args={[12, 64]} />
        <meshStandardMaterial color="#0b1220" roughness={0.95} metalness={0.1} />
      </mesh>
      <Table teamId="A" centerX={-2.35} accent="#66b1ff" activeSpeaker={activeSpeaker} />
      <Table teamId="B" centerX={2.35} accent="#ff7b72" activeSpeaker={activeSpeaker} />
    </group>
  );
}

const ROLE_ORDER: Role[] = ["ARCHITECT", "LOREKEEPER", "CONTRARIAN", "SYNTHESIZER"];

const ROLE_COLORS: Record<Role, string> = {
  ARCHITECT: "#7dd3fc",
  LOREKEEPER: "#a7f3d0",
  CONTRARIAN: "#fb7185",
  SYNTHESIZER: "#c084fc"
};

function seatPosition(role: Role): [number, number] {
  const idx = ROLE_ORDER.indexOf(role);
  const angle = (idx / ROLE_ORDER.length) * Math.PI * 2 + Math.PI / 4;
  const radius = 0.95;
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}

function Table({
  teamId,
  centerX,
  accent,
  activeSpeaker
}: {
  teamId: TeamId;
  centerX: number;
  accent: string;
  activeSpeaker: { teamId: TeamId; role: Role } | undefined;
}) {
  return (
    <group position={[centerX, 0, 0]}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[1.35, 1.35, 0.22, 64]} />
        <meshStandardMaterial color="#101826" roughness={0.75} metalness={0.18} />
      </mesh>
      <mesh position={[0, -0.22, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.28, 1.28, 0.18, 64]} />
        <meshStandardMaterial color="#0d1524" roughness={0.9} metalness={0.12} />
      </mesh>

      <mesh position={[0, 0.16, 0]} castShadow>
        <torusGeometry args={[0.98, 0.02, 8, 128]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.55} />
      </mesh>

      {ROLE_ORDER.map((role) => (
        <Seat
          key={role}
          role={role}
          teamId={teamId}
          active={activeSpeaker?.teamId === teamId && activeSpeaker?.role === role}
        />
      ))}
    </group>
  );
}

function Seat({ role, teamId, active }: { role: Role; teamId: TeamId; active: boolean }) {
  const [x, z] = seatPosition(role);
  const color = ROLE_COLORS[role];
  const lamp = useRef<THREE.PointLight>(null);
  const avatar = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (lamp.current) {
      lamp.current.intensity = active ? 1.35 + Math.sin(t * 6) * 0.25 : 0.15;
    }
    if (avatar.current) {
      avatar.current.position.y = 0.28 + (active ? Math.sin(t * 4) * 0.02 : 0);
    }
  });

  const baseColor = teamId === "A" ? "#0e1a33" : "#2a1011";

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.02, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.28, 0.3, 0.08, 32]} />
        <meshStandardMaterial color={baseColor} roughness={0.9} metalness={0.15} />
      </mesh>
      <mesh position={[0, 0.09, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.22, 0.02, 32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={active ? 0.95 : 0.3} />
      </mesh>

      <pointLight ref={lamp} position={[0, 0.28, 0]} color={color} intensity={active ? 1.3 : 0.12} distance={2} />

      <mesh ref={avatar} position={[0, 0.28, 0]} castShadow>
        <sphereGeometry args={[0.18, 32, 32]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.25} />
      </mesh>
    </group>
  );
}

function CameraRig({
  preset,
  activeSpeaker,
  reduceMotion,
  paused
}: {
  preset: CameraPreset;
  activeSpeaker: { teamId: TeamId; role: Role } | undefined;
  reduceMotion: boolean;
  paused: boolean;
}) {
  const controls = useRef<THREE.Object3D>(null);
  const desiredPos = useRef(new THREE.Vector3(0, 3.2, 8));
  const desiredTarget = useRef(new THREE.Vector3(0, 0, 0));

  const { camera, invalidate } = useThree();

  useEffect(() => {
    if (preset === "both") {
      desiredPos.current.set(0, 3.2, 8);
      desiredTarget.current.set(0, 0, 0);
    } else if (preset === "teamA") {
      desiredPos.current.set(-2.35, 2.4, 5.2);
      desiredTarget.current.set(-2.35, 0, 0);
    } else if (preset === "teamB") {
      desiredPos.current.set(2.35, 2.4, 5.2);
      desiredTarget.current.set(2.35, 0, 0);
    } else if (preset === "speaker" && activeSpeaker) {
      const centerX = activeSpeaker.teamId === "A" ? -2.35 : 2.35;
      const [sx, sz] = seatPosition(activeSpeaker.role);
      const seat = new THREE.Vector3(centerX + sx, 0.25, sz);
      desiredTarget.current.copy(seat);
      desiredPos.current.copy(seat).add(new THREE.Vector3(0, 1.45, 2.25));
    }

    invalidate();
  }, [activeSpeaker, invalidate, preset]);

  useFrame((_state, delta) => {
    if (paused) return;
    const alpha = reduceMotion ? 1 : Math.min(1, delta * 2.6);
    camera.position.lerp(desiredPos.current, alpha);
    camera.lookAt(desiredTarget.current);
  });

  return <group ref={controls} />;
}
