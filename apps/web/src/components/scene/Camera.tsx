import { useRef, useEffect } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { CAMERA_POSITIONS, type CameraPreset } from "@/styles/theme";

type SceneCameraProps = {
  preset: CameraPreset;
};

export function SceneCamera({ preset }: SceneCameraProps) {
  const { camera } = useThree();
  const controlsRef = useRef<typeof OrbitControls.prototype>(null);
  const targetPosition = useRef(new THREE.Vector3(...CAMERA_POSITIONS[preset].position));
  const targetLookAt = useRef(new THREE.Vector3(...CAMERA_POSITIONS[preset].target));

  useEffect(() => {
    const config = CAMERA_POSITIONS[preset];
    targetPosition.current.set(...config.position);
    targetLookAt.current.set(...config.target);
  }, [preset]);

  useFrame(() => {
    // Smoothly interpolate camera position
    camera.position.lerp(targetPosition.current, 0.05);

    // Update orbit controls target
    if (controlsRef.current) {
      controlsRef.current.target.lerp(targetLookAt.current, 0.05);
      controlsRef.current.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      enableZoom={true}
      minDistance={5}
      maxDistance={25}
      minPolarAngle={Math.PI / 6}
      maxPolarAngle={Math.PI / 2.2}
      dampingFactor={0.05}
      rotateSpeed={0.5}
    />
  );
}
