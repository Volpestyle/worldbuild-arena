export const API_BASE_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

function joinUrl(base: string, path: string): string {
  const trimmedBase = base.replace(/\/+$/, "");
  const trimmedPath = path.replace(/^\/+/, "");
  return `${trimmedBase}/${trimmedPath}`;
}

export type CreateMatchRequest = {
  seed?: number;
  tier: 1 | 2 | 3;
};

export type MatchSummary = {
  match_id: string;
  status: string;
};

export async function createMatch(request: CreateMatchRequest): Promise<MatchSummary> {
  const response = await fetch(joinUrl(API_BASE_URL, "/matches"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request)
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return (await response.json()) as MatchSummary;
}

export function matchEventsUrl(matchId: string, afterSeq = 0): string {
  const url = new URL(joinUrl(API_BASE_URL, `/matches/${matchId}/events`));
  url.searchParams.set("after", String(afterSeq));
  return url.toString();
}

export function matchArtifactsUrl(matchId: string): string {
  return joinUrl(API_BASE_URL, `/matches/${matchId}/artifacts`);
}

export function blindJudgingUrl(matchId: string): string {
  return joinUrl(API_BASE_URL, `/matches/${matchId}/judging/blind`);
}
