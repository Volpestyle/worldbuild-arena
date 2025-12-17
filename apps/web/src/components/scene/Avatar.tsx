import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { ROLE_COLORS, ROLE_GLYPHS, SEAT_POSITIONS } from "@/styles/theme";
import type { Role, TeamId } from "@wba/contracts";
import { SeatLamp } from "./SeatLamp";

type AvatarProps = {
  role: Role;
  teamId: TeamId;
  seatIndex: number;
  isActive: boolean;
};

export function Avatar({ role, teamId: _teamId, seatIndex, isActive }: AvatarProps) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const headRef = useRef<THREE.Mesh>(null);

  const color = ROLE_COLORS[role];
  const glyph = ROLE_GLYPHS[role];
  const position = SEAT_POSITIONS[seatIndex];

  // Calculate rotation to face center of table
  const angleToCenter = Math.atan2(-position[0], -position[2]);

  // Animation
  useFrame((state) => {
    if (!groupRef.current || !bodyRef.current || !headRef.current) return;

    const time = state.clock.elapsedTime;

    if (isActive) {
      // Active speaking animation - bob and subtle sway
      groupRef.current.position.y = Math.sin(time * 3) * 0.03;
      headRef.current.rotation.y = Math.sin(time * 2) * 0.1;
      bodyRef.current.rotation.z = Math.sin(time * 1.5) * 0.02;
    } else {
      // Idle - subtle breathing
      groupRef.current.position.y = Math.sin(time * 0.5) * 0.005;
      headRef.current.rotation.y = 0;
      bodyRef.current.rotation.z = 0;
    }
  });

  return (
    <group position={position} rotation={[0, angleToCenter, 0]}>
      <group ref={groupRef}>
        {/* Body */}
        <mesh ref={bodyRef} position={[0, 1.1, 0]} castShadow>
          <capsuleGeometry args={[0.25, 0.6, 4, 16]} />
          <meshStandardMaterial
            color={color}
            roughness={0.6}
            metalness={0.2}
            emissive={color}
            emissiveIntensity={isActive ? 0.15 : 0}
          />
        </mesh>

        {/* Head */}
        <mesh ref={headRef} position={[0, 1.75, 0]} castShadow>
          <sphereGeometry args={[0.22, 16, 16]} />
          <meshStandardMaterial
            color={color}
            roughness={0.5}
            metalness={0.2}
            emissive={color}
            emissiveIntensity={isActive ? 0.2 : 0}
          />
        </mesh>

        {/* Arms (simplified) */}
        <mesh position={[0.35, 1.0, 0]} rotation={[0, 0, -0.3]} castShadow>
          <capsuleGeometry args={[0.08, 0.4, 4, 8]} />
          <meshStandardMaterial color={color} roughness={0.6} metalness={0.2} />
        </mesh>
        <mesh position={[-0.35, 1.0, 0]} rotation={[0, 0, 0.3]} castShadow>
          <capsuleGeometry args={[0.08, 0.4, 4, 8]} />
          <meshStandardMaterial color={color} roughness={0.6} metalness={0.2} />
        </mesh>

        {/* Role badge floating above head */}
        <Html position={[0, 2.2, 0]} center distanceFactor={10}>
          <div
            style={{
              background: isActive
                ? `linear-gradient(135deg, ${color}, ${color}88)`
                : "rgba(10, 10, 15, 0.9)",
              color: isActive ? "white" : color,
              padding: "4px 8px",
              borderRadius: "4px",
              fontSize: "12px",
              fontWeight: 600,
              whiteSpace: "nowrap",
              border: `1px solid ${color}`,
              boxShadow: isActive ? `0 0 12px ${color}66` : "none",
              transition: "all 0.3s ease",
              pointerEvents: "none",
            }}
          >
            {glyph}
          </div>
        </Html>
      </group>

      {/* Seat lamp */}
      <SeatLamp isActive={isActive} color={color} />
    </group>
  );
}
