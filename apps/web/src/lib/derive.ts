import jsonpatch from "fast-json-patch";
import type { Operation } from "fast-json-patch";

import type {
  Canon,
  Challenge,
  JsonPatchOp,
  MatchEvent,
  PromptPack,
  Role,
  TeamId,
  TurnOutput,
  TurnType,
  VoteChoice
} from "@wba/contracts";

export type TeamView = {
  canon?: Canon;
  canonHash?: string;
  lastPatch?: {
    phase: number;
    round: number;
    patch: JsonPatchOp[];
    canonBeforeHash: string;
    canonAfterHash: string;
  };
  lastTurn?: {
    phase: number;
    round: number;
    turnId: string;
    output: TurnOutput;
  };
  lastValidationFailure?: {
    phase: number;
    round: number;
    turnId: string;
    errors: string[];
  };
  lastVote?: {
    phase: number;
    round: number;
    result: "ACCEPT" | "AMEND" | "REJECT" | "DEADLOCK";
    tally: Record<VoteChoice, number>;
  };
  promptPack?: PromptPack;
};

export type MatchView = {
  status: "idle" | "running" | "completed" | "failed";
  matchId?: string;
  seed?: number;
  tier?: 1 | 2 | 3;
  phase?: number;
  roundCount?: number;
  challenge?: Challenge;
  teams: Record<TeamId, TeamView>;
  activeSpeaker?: {
    teamId: TeamId;
    role: Role;
    turnType: TurnType;
  };
  lastEvent?: MatchEvent;
};

function safeApplyPatch(document: unknown, patch: JsonPatchOp[]): unknown {
  const clone = jsonpatch.deepClone(document);
  const result = jsonpatch.applyPatch(clone, patch as unknown as Operation[], true, true);
  return result.newDocument;
}

export function deriveMatchView(events: MatchEvent[], cursor: number): MatchView {
  const slice = events.slice(0, Math.max(0, Math.min(cursor, events.length)));

  const teams: Record<TeamId, TeamView> = { A: {}, B: {} };

  let status: MatchView["status"] = slice.length ? "running" : "idle";
  let seed: number | undefined;
  let tier: 1 | 2 | 3 | undefined;
  let phase: number | undefined;
  let roundCount: number | undefined;
  let challenge: Challenge | undefined;
  let activeSpeaker: MatchView["activeSpeaker"] | undefined;

  for (const event of slice) {
    if (event.type === "match_created") {
      seed = event.data.seed;
      tier = event.data.tier;
      continue;
    }
    if (event.type === "challenge_revealed") {
      challenge = event.data;
      continue;
    }
    if (event.type === "phase_started") {
      phase = event.data.phase;
      roundCount = event.data.round_count;
      continue;
    }
    if (event.type === "canon_initialized") {
      teams[event.team_id].canon = event.data.canon;
      teams[event.team_id].canonHash = event.data.canon_hash;
      continue;
    }
    if (event.type === "turn_emitted") {
      teams[event.team_id].lastTurn = {
        phase: event.data.phase,
        round: event.data.round,
        turnId: event.data.turn_id,
        output: event.data.output
      };
      activeSpeaker = {
        teamId: event.team_id,
        role: event.data.output.speaker_role,
        turnType: event.data.output.turn_type
      };
      continue;
    }
    if (event.type === "turn_validation_failed") {
      teams[event.team_id].lastValidationFailure = {
        phase: event.data.phase,
        round: event.data.round,
        turnId: event.data.turn_id,
        errors: event.data.errors
      };
      continue;
    }
    if (event.type === "vote_result") {
      teams[event.team_id].lastVote = {
        phase: event.data.phase,
        round: event.data.round,
        result: event.data.result,
        tally: event.data.tally
      };
      continue;
    }
    if (event.type === "canon_patch_applied") {
      const team = teams[event.team_id];
      if (team.canon) {
        try {
          team.canon = safeApplyPatch(team.canon, event.data.patch) as Canon;
          team.canonHash = event.data.canon_after_hash;
        } catch {
          // Ignore patch application failures in UI derivation.
        }
      }
      team.lastPatch = {
        phase: event.data.phase,
        round: event.data.round,
        patch: event.data.patch,
        canonBeforeHash: event.data.canon_before_hash,
        canonAfterHash: event.data.canon_after_hash
      };
      continue;
    }
    if (event.type === "prompt_pack_generated") {
      teams[event.team_id].promptPack = event.data.prompt_pack;
      continue;
    }
    if (event.type === "match_completed") {
      status = "completed";
      continue;
    }
    if (event.type === "match_failed") {
      status = "failed";
      continue;
    }
  }

  if (status === "idle" && slice.length) {
    status = "running";
  }

  return {
    status,
    matchId: slice[0]?.match_id,
    seed,
    tier,
    phase,
    roundCount,
    challenge,
    teams,
    activeSpeaker,
    lastEvent: slice[slice.length - 1]
  };
}
