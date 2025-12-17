import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type SeatLampProps = {
  isActive: boolean;
  color: string;
};

export function SeatLamp({ isActive, color }: SeatLampProps) {
  const lightRef = useRef<THREE.PointLight>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const targetIntensity = useRef(0);

  useFrame(() => {
    targetIntensity.current = isActive ? 2 : 0;

    if (lightRef.current) {
      lightRef.current.intensity = THREE.MathUtils.lerp(
        lightRef.current.intensity,
        targetIntensity.current,
        0.1
      );
    }

    if (glowRef.current) {
      const material = glowRef.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = THREE.MathUtils.lerp(
        material.emissiveIntensity,
        isActive ? 1 : 0.1,
        0.1
      );
    }
  });

  return (
    <group position={[0, 0.02, 0]}>
      {/* Lamp base */}
      <mesh>
        <cylinderGeometry args={[0.15, 0.18, 0.04, 12]} />
        <meshStandardMaterial color="#222230" roughness={0.8} metalness={0.3} />
      </mesh>

      {/* Lamp glow element */}
      <mesh ref={glowRef} position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.02, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isActive ? 1 : 0.1}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* Point light for illumination */}
      <pointLight
        ref={lightRef}
        position={[0, 0.2, 0]}
        color={color}
        intensity={isActive ? 2 : 0}
        distance={3}
        decay={2}
      />
    </group>
  );
}
