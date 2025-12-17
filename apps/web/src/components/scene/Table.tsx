import type { TeamId } from "@wba/contracts";

type TableProps = {
  teamId: TeamId;
};

export function Table({ teamId }: TableProps) {
  // Team A is slightly cooler tint, Team B is slightly warmer
  const tableColor = teamId === "A" ? "#2a2a3a" : "#3a2a2a";
  const edgeColor = teamId === "A" ? "#4a4a6a" : "#6a4a4a";

  return (
    <group>
      {/* Table top */}
      <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2, 2, 0.1, 32]} />
        <meshStandardMaterial color={tableColor} roughness={0.7} metalness={0.2} />
      </mesh>

      {/* Table edge ring */}
      <mesh position={[0, 0.75, 0]}>
        <torusGeometry args={[2, 0.05, 8, 32]} />
        <meshStandardMaterial color={edgeColor} roughness={0.3} metalness={0.5} />
      </mesh>

      {/* Central pillar */}
      <mesh position={[0, 0.35, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.4, 0.7, 16]} />
        <meshStandardMaterial color="#1a1a24" roughness={0.8} metalness={0.1} />
      </mesh>

      {/* Base */}
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <cylinderGeometry args={[0.8, 0.9, 0.04, 24]} />
        <meshStandardMaterial color="#1a1a24" roughness={0.9} metalness={0.1} />
      </mesh>

      {/* Team label on table */}
      <mesh position={[0, 0.81, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.5, 32]} />
        <meshStandardMaterial
          color={teamId === "A" ? "#3a4a6a" : "#6a4a3a"}
          roughness={0.5}
          metalness={0.3}
        />
      </mesh>
    </group>
  );
}
