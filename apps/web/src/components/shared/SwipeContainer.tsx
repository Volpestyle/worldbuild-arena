import { useState, type ReactNode, Children } from "react";
import { motion, type PanInfo } from "framer-motion";

type SwipeContainerProps = {
  children: ReactNode;
  initialIndex?: number;
  onIndexChange?: (index: number) => void;
};

export function SwipeContainer({
  children,
  initialIndex = 0,
  onIndexChange,
}: SwipeContainerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const childArray = Children.toArray(children);
  const childCount = childArray.length;

  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    const threshold = 50;
    const velocity = info.velocity.x;
    const offset = info.offset.x;

    let newIndex = currentIndex;

    // Use velocity for quick swipes, offset for slow drags
    if (velocity < -200 || offset < -threshold) {
      newIndex = Math.min(currentIndex + 1, childCount - 1);
    } else if (velocity > 200 || offset > threshold) {
      newIndex = Math.max(currentIndex - 1, 0);
    }

    if (newIndex !== currentIndex) {
      setCurrentIndex(newIndex);
      onIndexChange?.(newIndex);
    }
  };

  return (
    <div style={styles.container}>
      <motion.div
        style={styles.track}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        animate={{ x: `${-currentIndex * 100}%` }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        {childArray.map((child, i) => (
          <div key={i} style={styles.page}>
            {child}
          </div>
        ))}
      </motion.div>

      {/* Page indicators */}
      {childCount > 1 && (
        <div style={styles.indicators}>
          {childArray.map((_, i) => (
            <button
              key={i}
              style={{
                ...styles.indicator,
                ...(i === currentIndex ? styles.indicatorActive : {}),
              }}
              onClick={() => {
                setCurrentIndex(i);
                onIndexChange?.(i);
              }}
              aria-label={`Go to page ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "relative",
    width: "100%",
    overflow: "hidden",
  },
  track: {
    display: "flex",
    cursor: "grab",
  },
  page: {
    flexShrink: 0,
    width: "100%",
    padding: "0 4px",
  },
  indicators: {
    display: "flex",
    justifyContent: "center",
    gap: "8px",
    marginTop: "8px",
  },
  indicator: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "var(--color-border)",
    transition: "all 0.2s ease",
  },
  indicatorActive: {
    background: "var(--color-accent)",
    transform: "scale(1.2)",
  },
};
