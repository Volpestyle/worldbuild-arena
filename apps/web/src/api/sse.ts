import type { MatchEvent } from "@wba/contracts";

const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

export type SSECallbacks = {
  onEvent: (event: MatchEvent) => void;
  onError: (error: Error) => void;
  onClose?: () => void;
};

export function createMatchEventSource(
  matchId: string,
  afterSeq: number,
  callbacks: SSECallbacks
): () => void {
  const url = `${API_BASE}/matches/${matchId}/events?after=${afterSeq}`;
  const eventSource = new EventSource(url);

  eventSource.onmessage = (e) => {
    try {
      const event = JSON.parse(e.data) as MatchEvent;
      callbacks.onEvent(event);
    } catch (err) {
      console.error("Failed to parse SSE event:", err);
    }
  };

  eventSource.onerror = () => {
    callbacks.onError(new Error("SSE connection failed"));
    eventSource.close();
  };

  eventSource.addEventListener("close", () => {
    callbacks.onClose?.();
    eventSource.close();
  });

  return () => {
    eventSource.close();
  };
}

// Helper to create an SSE connection with auto-reconnect
export function createReconnectingEventSource(
  matchId: string,
  initialSeq: number,
  callbacks: SSECallbacks,
  options: { maxRetries?: number; retryDelay?: number } = {}
): () => void {
  const { maxRetries = 5, retryDelay = 2000 } = options;
  let retryCount = 0;
  let currentSeq = initialSeq;
  let cleanup: (() => void) | null = null;
  let stopped = false;

  const connect = () => {
    if (stopped) return;

    cleanup = createMatchEventSource(matchId, currentSeq, {
      onEvent: (event) => {
        retryCount = 0; // Reset retry count on successful event
        currentSeq = event.seq;
        callbacks.onEvent(event);
      },
      onError: (error) => {
        if (stopped) return;

        retryCount++;
        if (retryCount <= maxRetries) {
          console.log(`SSE reconnecting (attempt ${retryCount}/${maxRetries})...`);
          setTimeout(connect, retryDelay * retryCount);
        } else {
          callbacks.onError(error);
        }
      },
      onClose: callbacks.onClose,
    });
  };

  connect();

  return () => {
    stopped = true;
    cleanup?.();
  };
}
