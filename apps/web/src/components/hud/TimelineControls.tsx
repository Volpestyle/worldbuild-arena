import { useMatchStore, type PlaybackSpeed } from "@/state/matchStore";

export function TimelineControls() {
  const events = useMatchStore((s) => s.events);
  const currentIndex = useMatchStore((s) => s.currentIndex);
  const isPlaying = useMatchStore((s) => s.isPlaying);
  const playbackSpeed = useMatchStore((s) => s.playbackSpeed);
  const isLive = useMatchStore((s) => s.isLive);

  const seekTo = useMatchStore((s) => s.seekTo);
  const stepForward = useMatchStore((s) => s.stepForward);
  const stepBackward = useMatchStore((s) => s.stepBackward);
  const play = useMatchStore((s) => s.play);
  const pause = useMatchStore((s) => s.pause);
  const setSpeed = useMatchStore((s) => s.setSpeed);
  const goLive = useMatchStore((s) => s.goLive);

  const hasEvents = events.length > 0;
  const canStepBack = currentIndex > 0;
  const canStepForward = currentIndex < events.length - 1;

  return (
    <div style={styles.container}>
      <div style={styles.controls}>
        {/* Step backward */}
        <button
          style={styles.button}
          onClick={stepBackward}
          disabled={!canStepBack}
          aria-label="Step backward"
        >
          ⏮
        </button>

        {/* Play/Pause */}
        <button
          style={styles.playButton}
          onClick={isPlaying ? pause : play}
          disabled={!hasEvents || isLive}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? "⏸" : "▶"}
        </button>

        {/* Step forward */}
        <button
          style={styles.button}
          onClick={stepForward}
          disabled={!canStepForward}
          aria-label="Step forward"
        >
          ⏭
        </button>

        {/* Timeline scrubber */}
        <div style={styles.scrubber}>
          <input
            type="range"
            min={0}
            max={Math.max(0, events.length - 1)}
            value={currentIndex}
            onChange={(e) => seekTo(Number(e.target.value))}
            disabled={!hasEvents}
            style={styles.slider}
          />
        </div>

        {/* Event counter */}
        <span style={styles.counter}>
          {hasEvents ? `${currentIndex + 1}/${events.length}` : "0/0"}
        </span>

        {/* Speed selector */}
        <select
          value={playbackSpeed}
          onChange={(e) => setSpeed(Number(e.target.value) as PlaybackSpeed)}
          style={styles.speedSelect}
        >
          <option value={0.5}>0.5×</option>
          <option value={1}>1×</option>
          <option value={2}>2×</option>
          <option value={4}>4×</option>
        </select>

        {/* Live button */}
        <button
          style={{
            ...styles.liveButton,
            ...(isLive ? styles.liveButtonActive : {}),
          }}
          onClick={goLive}
          disabled={isLive}
        >
          LIVE
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: "rgba(10, 10, 15, 0.9)",
    borderRadius: "12px",
    padding: "12px",
    backdropFilter: "blur(12px)",
    border: "1px solid var(--color-border)",
  },
  controls: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  button: {
    width: "32px",
    height: "32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "6px",
    fontSize: "0.875rem",
    background: "var(--color-bg-elevated)",
  },
  playButton: {
    width: "40px",
    height: "40px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    fontSize: "1rem",
    background: "var(--color-accent)",
    color: "white",
  },
  scrubber: {
    flex: 1,
    minWidth: "80px",
  },
  slider: {
    width: "100%",
    height: "4px",
    cursor: "pointer",
    accentColor: "var(--color-accent)",
  },
  counter: {
    fontSize: "0.75rem",
    fontFamily: "monospace",
    color: "var(--color-text-muted)",
    minWidth: "50px",
    textAlign: "center",
  },
  speedSelect: {
    padding: "4px 8px",
    background: "var(--color-bg-elevated)",
    border: "1px solid var(--color-border)",
    borderRadius: "4px",
    fontSize: "0.75rem",
    color: "var(--color-text)",
  },
  liveButton: {
    padding: "6px 12px",
    borderRadius: "6px",
    fontSize: "0.625rem",
    fontWeight: 700,
    letterSpacing: "0.5px",
    color: "var(--color-text-muted)",
    border: "1px solid var(--color-border)",
  },
  liveButtonActive: {
    background: "var(--color-contrarian)",
    color: "white",
    border: "1px solid var(--color-contrarian)",
  },
};
