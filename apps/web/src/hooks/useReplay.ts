import { useEffect, useRef } from "react";
import { useMatchStore } from "@/state/matchStore";

/**
 * Hook that handles automatic playback of events.
 * When isPlaying is true, automatically advances to the next event
 * at the configured playback speed.
 */
export function useReplay() {
  const isPlaying = useMatchStore((s) => s.isPlaying);
  const playbackSpeed = useMatchStore((s) => s.playbackSpeed);
  const currentIndex = useMatchStore((s) => s.currentIndex);
  const eventsLength = useMatchStore((s) => s.events.length);
  const isLive = useMatchStore((s) => s.isLive);
  const stepForward = useMatchStore((s) => s.stepForward);
  const pause = useMatchStore((s) => s.pause);

  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Don't play if we're live or not playing
    if (!isPlaying || isLive) {
      return;
    }

    // Calculate interval based on playback speed
    // Base rate: 1 event per second at 1x speed
    const intervalMs = 1000 / playbackSpeed;

    intervalRef.current = window.setInterval(() => {
      // Check if we've reached the end
      if (currentIndex >= eventsLength - 1) {
        pause();
        return;
      }

      stepForward();
    }, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, playbackSpeed, isLive, currentIndex, eventsLength, stepForward, pause]);
}
