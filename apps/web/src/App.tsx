import { useCallback, useState } from "react";

type MatchSummary = {
  match_id: string;
  status: string;
};

export function App() {
  const [match, setMatch] = useState<MatchSummary | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const startMatch = useCallback(async () => {
    setError(null);
    setEvents([]);
    const response = await fetch("http://localhost:8000/matches", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tier: 1 })
    });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    const data = (await response.json()) as MatchSummary;
    setMatch(data);

    const source = new EventSource(`http://localhost:8000/matches/${data.match_id}/events`);
    source.onmessage = (message) => {
      setEvents((prev) => [...prev, message.data]);
    };
    source.onerror = () => {
      source.close();
    };
  }, []);

  return (
    <div className="page">
      <header className="header">
        <div>
          <div className="title">Worldbuild Arena</div>
          <div className="subtitle">Milestones 1–5 scaffold</div>
        </div>
        <button className="button" onClick={startMatch}>
          Start match
        </button>
      </header>

      {error ? <div className="error">{error}</div> : null}

      <main className="main">
        <div className="card">
          <div className="cardTitle">Match</div>
          <div className="mono">{match ? `${match.match_id} (${match.status})` : "—"}</div>
        </div>

        <div className="card">
          <div className="cardTitle">Events</div>
          <pre className="events">{events.join("\n")}</pre>
        </div>
      </main>
    </div>
  );
}
