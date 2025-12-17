import type { Canon, PromptPack, Challenge } from "@wba/contracts";

export type MatchStatus = "running" | "completed" | "failed";

export type MatchSummary = {
  match_id: string;
  status: MatchStatus;
  seed: number;
  tier: 1 | 2 | 3;
  created_at: string;
  completed_at: string | null;
};

export type MatchDetail = MatchSummary & {
  challenge: Challenge | null;
  canon_hash_a: string | null;
  canon_hash_b: string | null;
  error: string | null;
};

export type TeamArtifacts = {
  canon: Canon | null;
  prompt_pack: PromptPack | null;
};

export type ArtifactsResponse = {
  team_a: TeamArtifacts;
  team_b: TeamArtifacts;
};

export type BlindEntry = {
  blind_id: string;
  canon: Canon;
  prompt_pack: PromptPack | null;
};

export type BlindJudgingPackage = {
  match_id: string;
  entries: BlindEntry[];
};

export type JudgingScores = {
  internal_coherence: number;
  creative_ambition: number;
  visual_fidelity: number;
  artifact_quality: number;
  process_quality: number;
};

export type SubmitJudgingScoreRequest = {
  judge: string;
  blind_id: string;
  scores: JudgingScores;
  notes?: string;
};

export type JudgingScoreRecord = {
  id: string;
  match_id: string;
  created_at: string;
  judge: string;
  blind_id: string;
  scores: JudgingScores;
  notes: string | null;
};

export type BlindRevealMapping = Record<string, string>; // blind_id -> team_id
