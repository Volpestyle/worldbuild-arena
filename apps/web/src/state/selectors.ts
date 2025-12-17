import type {
  MatchEvent,
  TeamId,
  Canon,
  TurnOutput,
  Challenge,
  Role,
  VoteChoice,
} from "@wba/contracts";
import { deriveTeamCanon, deriveTeamCanonBefore } from "./canonDerive";
import type { MatchState } from "./matchStore";

// Get events up to the current playback index
export function selectVisibleEvents(state: MatchState): MatchEvent[] {
  return state.events.slice(0, state.currentIndex + 1);
}

// Derive canon state for a team
export function selectTeamCanon(
  state: MatchState,
  teamId: TeamId
): Canon | null {
  const events = selectVisibleEvents(state);
  return deriveTeamCanon(events, teamId);
}

// Derive canon state before the last patch (for diff view)
export function selectTeamCanonBefore(
  state: MatchState,
  teamId: TeamId
): Canon | null {
  const events = selectVisibleEvents(state);
  return deriveTeamCanonBefore(events, teamId);
}

// Get the challenge from events
export function selectChallenge(state: MatchState): Challenge | null {
  const events = selectVisibleEvents(state);
  const event = events.find((e) => e.type === "challenge_revealed");
  if (event?.type === "challenge_revealed") {
    return event.data;
  }
  return null;
}

// Get current phase and round
export type PhaseInfo = {
  phase: number;
  round: number;
  roundCount: number;
};

export function selectCurrentPhase(state: MatchState): PhaseInfo | null {
  const events = selectVisibleEvents(state);

  // Find the most recent phase_started event
  let phaseEvent: MatchEvent | null = null;
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].type === "phase_started") {
      phaseEvent = events[i];
      break;
    }
  }

  if (!phaseEvent || phaseEvent.type !== "phase_started") {
    return null;
  }

  // Count rounds by counting VOTE turn_emitted events in this phase
  // (Each round ends with votes)
  let round = 0;
  for (const e of events) {
    if (e.type === "phase_started" && e.data.phase > phaseEvent.data.phase) {
      break; // Past current phase
    }
    if (
      e.type === "turn_emitted" &&
      e.data.phase === phaseEvent.data.phase &&
      e.data.output.turn_type === "VOTE"
    ) {
      round = e.data.round;
    }
  }

  return {
    phase: phaseEvent.data.phase,
    round,
    roundCount: phaseEvent.data.round_count,
  };
}

// Get most recent turn for each team
export type TurnInfo = {
  phase: number;
  round: number;
  turnId: string;
  output: TurnOutput;
};

export function selectCurrentTurn(
  state: MatchState,
  teamId: TeamId
): TurnInfo | null {
  const events = selectVisibleEvents(state);

  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.type === "turn_emitted" && e.team_id === teamId) {
      return {
        phase: e.data.phase,
        round: e.data.round,
        turnId: e.data.turn_id,
        output: e.data.output,
      };
    }
  }

  return null;
}

// Get the active speaker (most recent turn_emitted)
export type ActiveSpeaker = {
  teamId: TeamId;
  role: Role;
  turnType: TurnOutput["turn_type"];
};

export function selectActiveSpeaker(state: MatchState): ActiveSpeaker | null {
  const events = selectVisibleEvents(state);

  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.type === "turn_emitted" && e.team_id) {
      return {
        teamId: e.team_id,
        role: e.data.output.speaker_role,
        turnType: e.data.output.turn_type,
      };
    }
  }

  return null;
}

// Get latest vote result for a team
export type VoteResultInfo = {
  phase: number;
  round: number;
  result: "ACCEPT" | "AMEND" | "REJECT" | "DEADLOCK";
  tally: Record<VoteChoice, number>;
};

export function selectVoteResult(
  state: MatchState,
  teamId: TeamId
): VoteResultInfo | null {
  const events = selectVisibleEvents(state);

  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.type === "vote_result" && e.team_id === teamId) {
      return {
        phase: e.data.phase,
        round: e.data.round,
        result: e.data.result,
        tally: e.data.tally,
      };
    }
  }

  return null;
}

// Get match status from events
export type MatchEventStatus = "running" | "completed" | "failed";

export function selectMatchStatus(state: MatchState): MatchEventStatus {
  const events = selectVisibleEvents(state);

  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.type === "match_completed") return "completed";
    if (e.type === "match_failed") return "failed";
  }

  return "running";
}

// Get the last patch for a team (for diff highlighting)
export function selectLastPatch(
  state: MatchState,
  teamId: TeamId
): MatchEvent | null {
  const events = selectVisibleEvents(state);

  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.type === "canon_patch_applied" && e.team_id === teamId) {
      return e;
    }
  }

  return null;
}

// Get prompt pack for a team (after phase 5)
export function selectPromptPack(
  state: MatchState,
  teamId: TeamId
): MatchEvent | null {
  const events = selectVisibleEvents(state);

  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.type === "prompt_pack_generated" && e.team_id === teamId) {
      return e;
    }
  }

  return null;
}
