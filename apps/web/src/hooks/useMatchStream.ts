import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { MatchEvent } from "@wba/contracts";
import { validateMatchEvent } from "@wba/contracts";

import { createMatch, matchEventsUrl } from "../lib/api";

export type ConnectionStatus = "idle" | "connecting" | "open" | "closed" | "error";

export type MatchStreamState = {
  matchId: string | null;
  connectionStatus: ConnectionStatus;
  events: MatchEvent[];
  error: string | null;
};

type StartMatchArgs = {
  seed?: number;
  tier: 1 | 2 | 3;
};

export function useMatchStream() {
  const [matchId, setMatchId] = useState<string | null>(() => localStorage.getItem("wba:lastMatchId"));
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  const sourceRef = useRef<EventSource | null>(null);
  const lastSeqRef = useRef<number>(0);

  const disconnect = useCallback(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
    setConnectionStatus("closed");
  }, []);

  const connect = useCallback(
    (newMatchId: string, afterSeq = 0) => {
      disconnect();
      setError(null);
      setConnectionStatus("connecting");
      lastSeqRef.current = afterSeq;

      const source = new EventSource(matchEventsUrl(newMatchId, afterSeq));
      sourceRef.current = source;

      source.onopen = () => setConnectionStatus("open");
      source.onmessage = (message) => {
        try {
          const parsed = JSON.parse(message.data) as unknown;
          if (!validateMatchEvent(parsed)) {
            // eslint-disable-next-line no-console
            console.warn("Invalid MatchEvent", validateMatchEvent.errors, parsed);
            return;
          }

          const event = parsed as MatchEvent;
          const nextSeq = Number(event.seq);
          if (Number.isFinite(nextSeq) && nextSeq <= lastSeqRef.current) {
            return;
          }
          lastSeqRef.current = nextSeq;
          setEvents((prev) => [...prev, event]);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        }
      };

      source.onerror = () => {
        setConnectionStatus("error");
        source.close();
      };
    },
    [disconnect]
  );

  const startMatch = useCallback(
    async ({ seed, tier }: StartMatchArgs) => {
      setError(null);
      setEvents([]);
      setConnectionStatus("connecting");
      lastSeqRef.current = 0;

      const summary = await createMatch({ seed, tier });
      setMatchId(summary.match_id);
      localStorage.setItem("wba:lastMatchId", summary.match_id);
      connect(summary.match_id, 0);
    },
    [connect]
  );

  useEffect(() => {
    if (!matchId) {
      return;
    }
    return () => {
      sourceRef.current?.close();
      sourceRef.current = null;
    };
  }, [matchId]);

  const state: MatchStreamState = useMemo(
    () => ({ matchId, connectionStatus, events, error }),
    [matchId, connectionStatus, events, error]
  );

  return {
    ...state,
    startMatch,
    connect,
    disconnect,
    setMatchId
  };
}

