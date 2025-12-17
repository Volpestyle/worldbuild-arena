import type { Role } from "@wba/contracts";

export const ROLE_COLORS: Record<Role, string> = {
  ARCHITECT: "#4a90d9",
  LOREKEEPER: "#9b59b6",
  CONTRARIAN: "#e74c3c",
  SYNTHESIZER: "#2ecc71",
};

export const ROLE_GLYPHS: Record<Role, string> = {
  ARCHITECT: "\u2302", // House symbol
  LOREKEEPER: "\u{1F4DC}", // Scroll emoji
  CONTRARIAN: "\u26A1", // Lightning
  SYNTHESIZER: "\u2696", // Balance scale
};

export const ROLE_LABELS: Record<Role, string> = {
  ARCHITECT: "Architect",
  LOREKEEPER: "Lorekeeper",
  CONTRARIAN: "Contrarian",
  SYNTHESIZER: "Synthesizer",
};

export const PHASE_NAMES: Record<number, string> = {
  0: "Challenge Reveal",
  1: "Foundation",
  2: "Landmark Development",
  3: "Tension Injection",
  4: "Spec Crystallization",
  5: "Artifact Generation",
  6: "Judgment",
};

export const PHASE_ROUND_COUNTS: Record<number, number> = {
  1: 3,
  2: 4,
  3: 2,
  4: 1,
};

export type LightingConfig = {
  ambient: number;
  directional: number;
  color: string;
  fogColor: string;
  fogNear: number;
  fogFar: number;
};

export const PHASE_LIGHTING: Record<number, LightingConfig> = {
  0: {
    ambient: 0.3,
    directional: 0.6,
    color: "#ffffff",
    fogColor: "#0a0a1a",
    fogNear: 15,
    fogFar: 40,
  },
  1: {
    ambient: 0.4,
    directional: 0.8,
    color: "#fff5e6",
    fogColor: "#1a1a2e",
    fogNear: 12,
    fogFar: 35,
  },
  2: {
    ambient: 0.5,
    directional: 1.0,
    color: "#ffffff",
    fogColor: "#1a1a2e",
    fogNear: 10,
    fogFar: 30,
  },
  3: {
    ambient: 0.3,
    directional: 0.6,
    color: "#ff9999",
    fogColor: "#2e1a1a",
    fogNear: 8,
    fogFar: 25,
  },
  4: {
    ambient: 0.6,
    directional: 1.2,
    color: "#e6f0ff",
    fogColor: "#1a1a3e",
    fogNear: 10,
    fogFar: 30,
  },
  5: {
    ambient: 0.5,
    directional: 1.0,
    color: "#ffd700",
    fogColor: "#1a1a1a",
    fogNear: 10,
    fogFar: 30,
  },
};

export const DEFAULT_LIGHTING: LightingConfig = PHASE_LIGHTING[0];

export type CameraPreset = "both" | "team_a" | "team_b" | "speaker";

export const CAMERA_POSITIONS: Record<
  CameraPreset,
  { position: [number, number, number]; target: [number, number, number] }
> = {
  both: { position: [0, 8, 14], target: [0, 0, 0] },
  team_a: { position: [-4, 5, 10], target: [-4, 0, 0] },
  team_b: { position: [4, 5, 10], target: [4, 0, 0] },
  speaker: { position: [0, 3, 6], target: [0, 1, 0] },
};

// Seat positions around a circular table (radius ~1.5)
export const SEAT_POSITIONS: [number, number, number][] = [
  [0, 0, 1.5], // Front
  [1.5, 0, 0], // Right
  [0, 0, -1.5], // Back
  [-1.5, 0, 0], // Left
];

// Role to seat mapping (consistent positions)
export const ROLE_SEAT_INDEX: Record<Role, number> = {
  ARCHITECT: 0,
  LOREKEEPER: 1,
  CONTRARIAN: 2,
  SYNTHESIZER: 3,
};
