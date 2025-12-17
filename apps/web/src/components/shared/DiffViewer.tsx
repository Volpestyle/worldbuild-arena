import { useMemo } from "react";

type DiffViewerProps = {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
};

type DiffLine = {
  key: string;
  type: "unchanged" | "added" | "removed" | "changed";
  oldValue?: string;
  newValue?: string;
  indent: number;
};

export function DiffViewer({ before, after }: DiffViewerProps) {
  const diffLines = useMemo(() => computeDiff(before, after), [before, after]);

  return (
    <div style={styles.container}>
      {diffLines.map((line, i) => (
        <div
          key={i}
          style={{
            ...styles.line,
            ...(line.type === "added"
              ? styles.added
              : line.type === "removed"
                ? styles.removed
                : line.type === "changed"
                  ? styles.changed
                  : {}),
            paddingLeft: `${12 + line.indent * 16}px`,
          }}
        >
          <span style={styles.linePrefix}>
            {line.type === "added"
              ? "+"
              : line.type === "removed"
                ? "-"
                : line.type === "changed"
                  ? "~"
                  : " "}
          </span>
          <span style={styles.key}>{line.key}:</span>
          {line.type === "changed" ? (
            <>
              <span style={styles.oldValue}>{line.oldValue}</span>
              <span style={styles.arrow}>→</span>
              <span style={styles.newValue}>{line.newValue}</span>
            </>
          ) : (
            <span style={styles.value}>
              {line.type === "removed" ? line.oldValue : line.newValue}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function computeDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  indent = 0,
  prefix = ""
): DiffLine[] {
  const lines: DiffLine[] = [];
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of allKeys) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const beforeVal = before[key];
    const afterVal = after[key];

    if (!(key in before)) {
      // Added
      lines.push({
        key,
        type: "added",
        newValue: formatValue(afterVal),
        indent,
      });
    } else if (!(key in after)) {
      // Removed
      lines.push({
        key,
        type: "removed",
        oldValue: formatValue(beforeVal),
        indent,
      });
    } else if (
      typeof beforeVal === "object" &&
      beforeVal !== null &&
      typeof afterVal === "object" &&
      afterVal !== null &&
      !Array.isArray(beforeVal) &&
      !Array.isArray(afterVal)
    ) {
      // Recurse into nested objects
      lines.push({
        key,
        type: "unchanged",
        newValue: "{",
        indent,
      });
      lines.push(
        ...computeDiff(
          beforeVal as Record<string, unknown>,
          afterVal as Record<string, unknown>,
          indent + 1,
          fullKey
        )
      );
    } else if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
      // Changed
      lines.push({
        key,
        type: "changed",
        oldValue: formatValue(beforeVal),
        newValue: formatValue(afterVal),
        indent,
      });
    } else {
      // Unchanged
      lines.push({
        key,
        type: "unchanged",
        newValue: formatValue(afterVal),
        indent,
      });
    }
  }

  return lines;
}

function formatValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") {
    // Truncate long strings
    if (value.length > 60) {
      return `"${value.slice(0, 57)}..."`;
    }
    return `"${value}"`;
  }
  if (Array.isArray(value)) {
    return `[${value.length} items]`;
  }
  if (typeof value === "object") {
    return "{...}";
  }
  return String(value);
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    fontFamily: "monospace",
    fontSize: "0.75rem",
    lineHeight: 1.6,
    background: "var(--color-bg)",
    borderRadius: "6px",
    padding: "8px 0",
    overflow: "auto",
  },
  line: {
    display: "flex",
    alignItems: "baseline",
    gap: "8px",
    padding: "2px 12px",
  },
  linePrefix: {
    width: "12px",
    flexShrink: 0,
    textAlign: "center",
    fontWeight: 700,
  },
  key: {
    color: "var(--color-architect)",
    flexShrink: 0,
  },
  value: {
    color: "var(--color-text)",
    wordBreak: "break-word",
  },
  oldValue: {
    color: "var(--color-contrarian)",
    textDecoration: "line-through",
    opacity: 0.7,
  },
  arrow: {
    color: "var(--color-text-muted)",
    flexShrink: 0,
  },
  newValue: {
    color: "var(--color-synthesizer)",
    wordBreak: "break-word",
  },
  added: {
    background: "rgba(46, 204, 113, 0.1)",
  },
  removed: {
    background: "rgba(231, 76, 60, 0.1)",
  },
  changed: {
    background: "rgba(155, 89, 182, 0.1)",
  },
};
