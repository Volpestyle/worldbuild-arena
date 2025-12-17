import { useEffect, useRef } from "react";
import { useMatchStore } from "@/state/matchStore";
import { fetchMatch } from "@/api/client";
import { createReconnectingEventSource } from "@/api/sse";

export function useMatch(matchId: string) {
  const store = useMatchStore();
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Reset store for new match
    store.reset();
    store.setMatchId(matchId);
    store.setLoading(true);

    // Fetch match details
    fetchMatch(matchId)
      .then((detail) => {
        store.setMatchDetail(detail);
        store.setError(null);
      })
      .catch((err) => {
        store.setError(err);
      })
      .finally(() => {
        store.setLoading(false);
      });

    // Connect to SSE for events
    const lastSeq = store.events.length > 0 ? store.events[store.events.length - 1].seq : 0;

    cleanupRef.current = createReconnectingEventSource(
      matchId,
      lastSeq,
      {
        onEvent: (event) => {
          store.appendEvent(event);
          store.setConnected(true);
        },
        onError: (error) => {
          console.error("SSE error:", error);
          store.setConnected(false);
        },
        onClose: () => {
          store.setConnected(false);
        },
      },
      { maxRetries: 5, retryDelay: 2000 }
    );

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [matchId]);

  return {
    isLoading: store.isLoading,
    error: store.error,
    matchDetail: store.matchDetail,
    isConnected: store.isConnected,
  };
}
