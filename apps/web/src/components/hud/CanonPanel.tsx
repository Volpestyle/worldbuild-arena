import { useState } from "react";
import { motion } from "framer-motion";
import { useShallow } from "zustand/react/shallow";
import type { TeamId } from "@wba/contracts";
import { useMatchStore } from "@/state/matchStore";
import { selectTeamCanon, selectTeamCanonBefore } from "@/state/selectors";
import { DiffViewer } from "@/components/shared/DiffViewer";

type CanonPanelProps = {
  onClose: () => void;
};

export function CanonPanel({ onClose }: CanonPanelProps) {
  const [selectedTeam, setSelectedTeam] = useState<TeamId>("A");
  const [showDiff, setShowDiff] = useState(false);

  const canon = useMatchStore(useShallow((s) => selectTeamCanon(s, selectedTeam)));
  const canonBefore = useMatchStore(useShallow((s) => selectTeamCanonBefore(s, selectedTeam)));

  return (
    <motion.div style={styles.container} layout>
      {/* Header */}
      <div style={styles.header}>
        <h3 style={styles.title}>Canon</h3>
        <div style={styles.tabs}>
          <button
            style={{
              ...styles.tab,
              ...(selectedTeam === "A" ? styles.tabActive : {}),
            }}
            onClick={() => setSelectedTeam("A")}
          >
            Team A
          </button>
          <button
            style={{
              ...styles.tab,
              ...(selectedTeam === "B" ? styles.tabActive : {}),
            }}
            onClick={() => setSelectedTeam("B")}
          >
            Team B
          </button>
        </div>
        <button
          style={{
            ...styles.diffToggle,
            ...(showDiff ? styles.diffToggleActive : {}),
          }}
          onClick={() => setShowDiff(!showDiff)}
        >
          Diff
        </button>
        <button style={styles.closeButton} onClick={onClose}>
          ×
        </button>
      </div>

      {/* Content */}
      <div style={styles.content}>
        {!canon ? (
          <div style={styles.empty}>Canon not yet initialized</div>
        ) : showDiff && canonBefore ? (
          <DiffViewer before={canonBefore} after={canon} />
        ) : (
          <CanonDisplay canon={canon} />
        )}
      </div>
    </motion.div>
  );
}

type CanonDisplayProps = {
  canon: ReturnType<typeof selectTeamCanon>;
};

function CanonDisplay({ canon }: CanonDisplayProps) {
  if (!canon) return null;

  return (
    <div style={styles.canonDisplay}>
      <CanonField label="World Name" value={canon.world_name} />
      <CanonField label="Governing Logic" value={canon.governing_logic} />
      <CanonField label="Aesthetic Mood" value={canon.aesthetic_mood} />

      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>Landmarks</h4>
        {canon.landmarks.map((landmark, i) => (
          <div key={i} style={styles.landmark}>
            <strong>{landmark.name || `Landmark ${i + 1}`}</strong>
            {landmark.description && <p>{landmark.description}</p>}
          </div>
        ))}
      </div>

      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>Inhabitants</h4>
        <CanonField label="Appearance" value={canon.inhabitants.appearance} />
        <CanonField label="Culture" value={canon.inhabitants.culture_snapshot} />
        <CanonField label="Relationship" value={canon.inhabitants.relationship_to_place} />
      </div>

      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>Tension</h4>
        <CanonField label="Conflict" value={canon.tension.conflict} />
        <CanonField label="Stakes" value={canon.tension.stakes} />
        <CanonField label="Visual" value={canon.tension.visual_manifestation} />
      </div>

      {canon.hero_image_description && (
        <div style={styles.section}>
          <h4 style={styles.sectionTitle}>Hero Image</h4>
          <p style={styles.heroDesc}>{canon.hero_image_description}</p>
        </div>
      )}
    </div>
  );
}

function CanonField({ label, value }: { label: string; value: string }) {
  if (!value) return null;

  return (
    <div style={styles.field}>
      <span style={styles.fieldLabel}>{label}:</span>
      <span style={styles.fieldValue}>{value}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: "rgba(10, 10, 15, 0.95)",
    borderRadius: "12px",
    overflow: "hidden",
    backdropFilter: "blur(12px)",
    border: "1px solid var(--color-border)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px",
    borderBottom: "1px solid var(--color-border)",
  },
  title: {
    fontSize: "0.875rem",
    fontWeight: 600,
    marginRight: "auto",
  },
  tabs: {
    display: "flex",
    gap: "4px",
  },
  tab: {
    padding: "4px 12px",
    borderRadius: "4px",
    fontSize: "0.75rem",
    color: "var(--color-text-muted)",
  },
  tabActive: {
    background: "var(--color-accent)",
    color: "white",
  },
  diffToggle: {
    padding: "4px 8px",
    borderRadius: "4px",
    fontSize: "0.625rem",
    color: "var(--color-text-muted)",
    border: "1px solid var(--color-border)",
  },
  diffToggleActive: {
    background: "var(--color-lorekeeper)",
    color: "white",
    border: "1px solid var(--color-lorekeeper)",
  },
  closeButton: {
    padding: "4px 8px",
    fontSize: "1.25rem",
    color: "var(--color-text-muted)",
  },
  content: {
    maxHeight: "40vh",
    overflowY: "auto",
    padding: "12px",
  },
  empty: {
    textAlign: "center",
    color: "var(--color-text-muted)",
    padding: "24px",
  },
  canonDisplay: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  field: {
    display: "flex",
    gap: "8px",
    fontSize: "0.8rem",
  },
  fieldLabel: {
    color: "var(--color-text-muted)",
    flexShrink: 0,
  },
  fieldValue: {
    color: "var(--color-text)",
  },
  section: {
    paddingTop: "8px",
    borderTop: "1px solid var(--color-border)",
  },
  sectionTitle: {
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "var(--color-accent)",
    marginBottom: "8px",
  },
  landmark: {
    padding: "8px",
    background: "var(--color-bg-elevated)",
    borderRadius: "6px",
    marginBottom: "8px",
    fontSize: "0.8rem",
  },
  heroDesc: {
    fontSize: "0.8rem",
    lineHeight: 1.5,
    color: "var(--color-text)",
  },
};
