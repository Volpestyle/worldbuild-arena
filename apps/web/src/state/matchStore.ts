import { create } from "zustand";
import type { MatchEvent } from "@wba/contracts";
import type { MatchDetail } from "@/api/types";

export type PlaybackSpeed = 0.5 | 1 | 2 | 4;

export type MatchState = {
  // Match metadata
  matchId: string | null;
  matchDetail: MatchDetail | null;

  // Event log (append-only)
  events: MatchEvent[];

  // Playback position
  currentIndex: number;

  // Playback state
  isPlaying: boolean;
  playbackSpeed: PlaybackSpeed;

  // Connection state
  isConnected: boolean;
  isLive: boolean; // true if currentIndex === events.length - 1

  // Loading/error state
  isLoading: boolean;
  error: Error | null;
};

export type MatchActions = {
  // Initialization
  setMatchId: (matchId: string) => void;
  setMatchDetail: (detail: MatchDetail) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: Error | null) => void;

  // Event handling
  appendEvent: (event: MatchEvent) => void;
  setEvents: (events: MatchEvent[]) => void;

  // Playback controls
  seekTo: (index: number) => void;
  stepForward: () => void;
  stepBackward: () => void;
  play: () => void;
  pause: () => void;
  setSpeed: (speed: PlaybackSpeed) => void;
  goLive: () => void;

  // Connection
  setConnected: (connected: boolean) => void;

  // Reset
  reset: () => void;
};

const initialState: MatchState = {
  matchId: null,
  matchDetail: null,
  events: [],
  currentIndex: -1,
  isPlaying: false,
  playbackSpeed: 1,
  isConnected: false,
  isLive: true,
  isLoading: false,
  error: null,
};

export const useMatchStore = create<MatchState & MatchActions>((set, get) => ({
  ...initialState,

  setMatchId: (matchId) => set({ matchId }),

  setMatchDetail: (detail) => set({ matchDetail: detail }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  appendEvent: (event) => {
    const { events, isLive } = get();

    // Check if we already have this event (by seq)
    if (events.some((e) => e.seq === event.seq)) {
      return;
    }

    const newEvents = [...events, event].sort((a, b) => a.seq - b.seq);
    const newIndex = isLive ? newEvents.length - 1 : get().currentIndex;

    set({
      events: newEvents,
      currentIndex: newIndex,
      isLive: newIndex === newEvents.length - 1,
    });
  },

  setEvents: (events) => {
    const sorted = [...events].sort((a, b) => a.seq - b.seq);
    set({
      events: sorted,
      currentIndex: sorted.length - 1,
      isLive: true,
    });
  },

  seekTo: (index) => {
    const { events } = get();
    const clampedIndex = Math.max(-1, Math.min(index, events.length - 1));
    set({
      currentIndex: clampedIndex,
      isLive: clampedIndex === events.length - 1,
      isPlaying: false,
    });
  },

  stepForward: () => {
    const { events, currentIndex } = get();
    if (currentIndex < events.length - 1) {
      const newIndex = currentIndex + 1;
      set({
        currentIndex: newIndex,
        isLive: newIndex === events.length - 1,
      });
    }
  },

  stepBackward: () => {
    const { currentIndex } = get();
    if (currentIndex > 0) {
      set({
        currentIndex: currentIndex - 1,
        isLive: false,
      });
    }
  },

  play: () => set({ isPlaying: true }),

  pause: () => set({ isPlaying: false }),

  setSpeed: (speed) => set({ playbackSpeed: speed }),

  goLive: () => {
    const { events } = get();
    set({
      currentIndex: events.length - 1,
      isLive: true,
      isPlaying: false,
    });
  },

  setConnected: (connected) => set({ isConnected: connected }),

  reset: () => set(initialState),
}));
