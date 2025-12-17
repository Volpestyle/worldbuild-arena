import type { Canon, PromptPack } from "@wba/contracts";
import { ArtifactCard } from "./ArtifactCard";

type ArtifactGalleryProps = {
  canon: Canon | null;
  promptPack: PromptPack | null;
};

type ArtifactType = "hero" | "landmark" | "portrait" | "tension";

type ArtifactItem = {
  type: ArtifactType;
  title: string;
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: string;
  canonRef?: string;
};

export function ArtifactGallery({ canon, promptPack }: ArtifactGalleryProps) {
  if (!promptPack) {
    return (
      <div style={styles.empty}>
        <p>No artifacts generated yet</p>
        <p style={styles.emptyHint}>
          Artifacts are generated after Phase 5 completes
        </p>
      </div>
    );
  }

  const artifacts: ArtifactItem[] = [
    {
      type: "hero",
      title: promptPack.hero_image.title,
      prompt: promptPack.hero_image.prompt,
      negativePrompt: promptPack.hero_image.negative_prompt,
      aspectRatio: promptPack.hero_image.aspect_ratio ?? "16:9",
      canonRef: canon?.hero_image_description,
    },
    ...promptPack.landmark_triptych.map((landmark, i) => ({
      type: "landmark" as const,
      title: landmark.title || `Landmark ${i + 1}`,
      prompt: landmark.prompt,
      negativePrompt: landmark.negative_prompt,
      aspectRatio: landmark.aspect_ratio ?? "1:1",
      canonRef: canon?.landmarks[i]?.description,
    })),
    {
      type: "portrait",
      title: promptPack.inhabitant_portrait.title,
      prompt: promptPack.inhabitant_portrait.prompt,
      negativePrompt: promptPack.inhabitant_portrait.negative_prompt,
      aspectRatio: promptPack.inhabitant_portrait.aspect_ratio ?? "3:4",
      canonRef: canon?.inhabitants.appearance,
    },
    {
      type: "tension",
      title: promptPack.tension_snapshot.title,
      prompt: promptPack.tension_snapshot.prompt,
      negativePrompt: promptPack.tension_snapshot.negative_prompt,
      aspectRatio: promptPack.tension_snapshot.aspect_ratio ?? "16:9",
      canonRef: canon?.tension.visual_manifestation,
    },
  ];

  return (
    <div style={styles.grid}>
      {artifacts.map((artifact, i) => (
        <ArtifactCard key={i} artifact={artifact} />
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: "16px",
  },
  empty: {
    textAlign: "center",
    padding: "48px 24px",
    color: "var(--color-text-muted)",
  },
  emptyHint: {
    fontSize: "0.875rem",
    marginTop: "8px",
  },
};
