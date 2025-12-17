import type {
  MatchSummary,
  MatchDetail,
  ArtifactsResponse,
  BlindJudgingPackage,
  BlindRevealMapping,
  SubmitJudgingScoreRequest,
  JudgingScoreRecord,
} from "./types";

const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }

  return res.json();
}

export async function fetchMatches(): Promise<MatchSummary[]> {
  return apiFetch<MatchSummary[]>("/matches");
}

export async function fetchMatch(matchId: string): Promise<MatchDetail> {
  return apiFetch<MatchDetail>(`/matches/${matchId}`);
}

export async function createMatch(
  seed?: number,
  tier: 1 | 2 | 3 = 1
): Promise<MatchSummary> {
  return apiFetch<MatchSummary>("/matches", {
    method: "POST",
    body: JSON.stringify({ seed, tier }),
  });
}

export async function fetchArtifacts(matchId: string): Promise<ArtifactsResponse> {
  return apiFetch<ArtifactsResponse>(`/matches/${matchId}/artifacts`);
}

export async function fetchBlindJudgingPackage(
  matchId: string
): Promise<BlindJudgingPackage> {
  return apiFetch<BlindJudgingPackage>(`/matches/${matchId}/judging/blind`);
}

export async function revealBlindMapping(
  matchId: string
): Promise<BlindRevealMapping> {
  return apiFetch<BlindRevealMapping>(`/matches/${matchId}/judging/reveal`);
}

export async function submitJudgingScore(
  matchId: string,
  request: SubmitJudgingScoreRequest
): Promise<JudgingScoreRecord> {
  return apiFetch<JudgingScoreRecord>(`/matches/${matchId}/judging/scores`, {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function fetchJudgingScores(
  matchId: string
): Promise<JudgingScoreRecord[]> {
  return apiFetch<JudgingScoreRecord[]>(`/matches/${matchId}/judging/scores`);
}
