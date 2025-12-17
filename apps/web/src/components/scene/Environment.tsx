import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PHASE_LIGHTING, DEFAULT_LIGHTING, type LightingConfig } from "@/styles/theme";

type EnvironmentProps = {
  phase: number;
};

export function Environment({ phase }: EnvironmentProps) {
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const directionalRef = useRef<THREE.DirectionalLight>(null);
  const fogRef = useRef<THREE.Fog>(null);

  const config: LightingConfig = PHASE_LIGHTING[phase] ?? DEFAULT_LIGHTING;

  // Smoothly interpolate lighting values
  useFrame(() => {
    if (ambientRef.current) {
      ambientRef.current.intensity = THREE.MathUtils.lerp(
        ambientRef.current.intensity,
        config.ambient,
        0.05
      );
    }

    if (directionalRef.current) {
      directionalRef.current.intensity = THREE.MathUtils.lerp(
        directionalRef.current.intensity,
        config.directional,
        0.05
      );

      const targetColor = new THREE.Color(config.color);
      directionalRef.current.color.lerp(targetColor, 0.05);
    }

    if (fogRef.current) {
      const targetFogColor = new THREE.Color(config.fogColor);
      fogRef.current.color.lerp(targetFogColor, 0.05);
      fogRef.current.near = THREE.MathUtils.lerp(fogRef.current.near, config.fogNear, 0.05);
      fogRef.current.far = THREE.MathUtils.lerp(fogRef.current.far, config.fogFar, 0.05);
    }
  });

  return (
    <>
      {/* Ambient light for base illumination */}
      <ambientLight ref={ambientRef} intensity={config.ambient} />

      {/* Main directional light (sun-like) */}
      <directionalLight
        ref={directionalRef}
        position={[10, 15, 8]}
        intensity={config.directional}
        color={config.color}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={50}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
      />

      {/* Fill light from opposite side */}
      <directionalLight
        position={[-8, 8, -5]}
        intensity={config.directional * 0.3}
        color="#4466aa"
      />

      {/* Rim light for depth */}
      <pointLight position={[0, 3, -10]} intensity={0.5} color="#6644aa" />

      {/* Fog for atmosphere */}
      <fog ref={fogRef} attach="fog" args={[config.fogColor, config.fogNear, config.fogFar]} />

      {/* Background color */}
      <color attach="background" args={[config.fogColor]} />
    </>
  );
}
