import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type ArtifactType = "hero" | "landmark" | "portrait" | "tension";

type ArtifactItem = {
  type: ArtifactType;
  title: string;
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: string;
  canonRef?: string;
  imageUrl?: string;
};

type ArtifactCardProps = {
  artifact: ArtifactItem;
};

const TYPE_COLORS: Record<ArtifactType, string> = {
  hero: "var(--color-accent)",
  landmark: "var(--color-architect)",
  portrait: "var(--color-lorekeeper)",
  tension: "var(--color-contrarian)",
};

const TYPE_LABELS: Record<ArtifactType, string> = {
  hero: "Hero Image",
  landmark: "Landmark",
  portrait: "Portrait",
  tension: "Tension",
};

export function ArtifactCard({ artifact }: ArtifactCardProps) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [imageError, setImageError] = useState(false);

  const aspectRatioStyle = getAspectRatioStyle(artifact.aspectRatio);
  const typeColor = TYPE_COLORS[artifact.type];

  return (
    <motion.div
      style={styles.card}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Header */}
      <div style={styles.header}>
        <span style={{ ...styles.typeBadge, background: typeColor }}>
          {TYPE_LABELS[artifact.type]}
        </span>
        <h3 style={styles.title}>{artifact.title}</h3>
      </div>

      {/* Image area */}
      <div style={{ ...styles.imageContainer, ...aspectRatioStyle }}>
        {artifact.imageUrl && !imageError ? (
          <img
            src={artifact.imageUrl}
            alt={artifact.title}
            style={styles.image}
            onError={() => setImageError(true)}
          />
        ) : (
          <div style={styles.placeholder}>
            <span style={styles.placeholderIcon}>🖼️</span>
            <span style={styles.placeholderText}>
              {imageError ? "Failed to load" : "Generating..."}
            </span>
          </div>
        )}

        {/* Prompt overlay toggle */}
        <button
          style={styles.promptToggle}
          onClick={() => setShowPrompt(!showPrompt)}
        >
          {showPrompt ? "Hide Prompt" : "View Prompt"}
        </button>
      </div>

      {/* Prompt overlay */}
      <AnimatePresence>
        {showPrompt && (
          <motion.div
            style={styles.promptOverlay}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            <div style={styles.promptSection}>
              <h4 style={styles.promptLabel}>Prompt</h4>
              <p style={styles.promptText}>{artifact.prompt}</p>
            </div>

            {artifact.negativePrompt && (
              <div style={styles.promptSection}>
                <h4 style={{ ...styles.promptLabel, color: "var(--color-contrarian)" }}>
                  Negative
                </h4>
                <p style={styles.promptText}>{artifact.negativePrompt}</p>
              </div>
            )}

            {artifact.canonRef && (
              <div style={styles.promptSection}>
                <h4 style={{ ...styles.promptLabel, color: "var(--color-lorekeeper)" }}>
                  Canon Reference
                </h4>
                <p style={styles.promptText}>{artifact.canonRef}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function getAspectRatioStyle(aspectRatio?: string): React.CSSProperties {
  if (!aspectRatio) return { aspectRatio: "16/9" };

  const [w, h] = aspectRatio.split(":").map(Number);
  if (!w || !h) return { aspectRatio: "16/9" };

  return { aspectRatio: `${w}/${h}` };
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: "var(--color-bg-panel)",
    borderRadius: "12px",
    overflow: "hidden",
    border: "1px solid var(--color-border)",
  },
  header: {
    padding: "12px",
    borderBottom: "1px solid var(--color-border)",
  },
  typeBadge: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "4px",
    fontSize: "0.625rem",
    fontWeight: 700,
    color: "white",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: "4px",
  },
  title: {
    fontSize: "0.9rem",
    fontWeight: 600,
    margin: 0,
  },
  imageContainer: {
    position: "relative",
    background: "var(--color-bg)",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  placeholder: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    background: "linear-gradient(135deg, var(--color-bg-panel), var(--color-bg))",
  },
  placeholderIcon: {
    fontSize: "2rem",
    opacity: 0.5,
  },
  placeholderText: {
    fontSize: "0.75rem",
    color: "var(--color-text-muted)",
  },
  promptToggle: {
    position: "absolute",
    bottom: "8px",
    right: "8px",
    padding: "6px 12px",
    background: "rgba(10, 10, 15, 0.9)",
    borderRadius: "6px",
    fontSize: "0.625rem",
    fontWeight: 600,
    color: "var(--color-text)",
    backdropFilter: "blur(8px)",
  },
  promptOverlay: {
    padding: "12px",
    background: "var(--color-bg-elevated)",
    borderTop: "1px solid var(--color-border)",
    maxHeight: "200px",
    overflowY: "auto",
  },
  promptSection: {
    marginBottom: "12px",
  },
  promptLabel: {
    fontSize: "0.625rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    color: "var(--color-accent)",
    marginBottom: "4px",
  },
  promptText: {
    fontSize: "0.8rem",
    lineHeight: 1.5,
    color: "var(--color-text)",
    margin: 0,
  },
};
