import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

type CollapsiblePanelProps = {
  title: string;
  children: ReactNode;
  defaultExpanded?: boolean;
  badge?: string | number;
};

export function CollapsiblePanel({
  title,
  children,
  defaultExpanded = false,
  badge,
}: CollapsiblePanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div style={styles.container}>
      <button style={styles.header} onClick={() => setExpanded(!expanded)}>
        <span style={styles.title}>{title}</span>
        {badge !== undefined && <span style={styles.badge}>{badge}</span>}
        <motion.span
          style={styles.chevron}
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          ▼
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            style={styles.content}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div style={styles.inner}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: "var(--color-bg-panel)",
    borderRadius: "8px",
    overflow: "hidden",
    border: "1px solid var(--color-border)",
  },
  header: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    padding: "12px",
    textAlign: "left",
  },
  title: {
    flex: 1,
    fontSize: "0.875rem",
    fontWeight: 600,
  },
  badge: {
    padding: "2px 8px",
    background: "var(--color-bg-elevated)",
    borderRadius: "12px",
    fontSize: "0.75rem",
    color: "var(--color-text-muted)",
    marginRight: "8px",
  },
  chevron: {
    fontSize: "0.625rem",
    color: "var(--color-text-muted)",
  },
  content: {
    overflow: "hidden",
  },
  inner: {
    padding: "0 12px 12px",
  },
};
