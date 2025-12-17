export type TeamId = "A" | "B";

export type Role = "ARCHITECT" | "LOREKEEPER" | "CONTRARIAN" | "SYNTHESIZER";

export type TurnType = "PROPOSAL" | "OBJECTION" | "RESPONSE" | "RESOLUTION" | "VOTE";

export type VoteChoice = "ACCEPT" | "AMEND" | "REJECT";

export type JsonPatchOp =
  | { op: "add"; path: string; value: unknown }
  | { op: "remove"; path: string }
  | { op: "replace"; path: string; value: unknown }
  | { op: "move"; from: string; path: string }
  | { op: "copy"; from: string; path: string }
  | { op: "test"; path: string; value: unknown };

export type CanonLandmark = {
  name: string;
  description: string;
  significance: string;
  visual_key: string;
};

export type Canon = {
  world_name: string;
  governing_logic: string;
  aesthetic_mood: string;
  landmarks: [CanonLandmark, CanonLandmark, CanonLandmark];
  inhabitants: {
    appearance: string;
    culture_snapshot: string;
    relationship_to_place: string;
  };
  tension: {
    conflict: string;
    stakes: string;
    visual_manifestation: string;
  };
  hero_image_description: string;
};

export type TurnOutput = {
  speaker_role: Role;
  turn_type: TurnType;
  content: string;
  canon_patch?: JsonPatchOp[];
  references?: string[];
  vote?: {
    choice: VoteChoice;
    amendment_summary?: string;
  };
};

export type Challenge = {
  seed: number;
  tier: 1 | 2 | 3;
  biome_setting: string;
  inhabitants: string;
  twist_constraint: string;
};

export type Prompt = {
  title: string;
  prompt: string;
  negative_prompt?: string;
  aspect_ratio?: string;
};

export type PromptPack = {
  hero_image: Prompt;
  landmark_triptych: [Prompt, Prompt, Prompt];
  inhabitant_portrait: Prompt;
  tension_snapshot: Prompt;
};

export type MatchEventType =
  | "match_created"
  | "challenge_revealed"
  | "phase_started"
  | "canon_initialized"
  | "turn_emitted"
  | "turn_validation_failed"
  | "vote_result"
  | "canon_patch_applied"
  | "prompt_pack_generated"
  | "match_completed"
  | "match_failed";

export type MatchEvent =
  | {
      id: string;
      seq: number;
      ts: string;
      match_id: string;
      team_id: null;
      type: "match_created";
      data: { seed: number; tier: 1 | 2 | 3 };
    }
  | {
      id: string;
      seq: number;
      ts: string;
      match_id: string;
      team_id: null;
      type: "challenge_revealed";
      data: Challenge;
    }
  | {
      id: string;
      seq: number;
      ts: string;
      match_id: string;
      team_id: null;
      type: "phase_started";
      data: { phase: number; round_count: number };
    }
  | {
      id: string;
      seq: number;
      ts: string;
      match_id: string;
      team_id: TeamId;
      type: "canon_initialized";
      data: {
        canon: Canon;
        canon_hash: string;
      };
    }
  | {
      id: string;
      seq: number;
      ts: string;
      match_id: string;
      team_id: TeamId;
      type: "turn_emitted";
      data: {
        phase: number;
        round: number;
        turn_id: string;
        output: TurnOutput;
      };
    }
  | {
      id: string;
      seq: number;
      ts: string;
      match_id: string;
      team_id: TeamId;
      type: "turn_validation_failed";
      data: {
        phase: number;
        round: number;
        turn_id: string;
        errors: string[];
      };
    }
  | {
      id: string;
      seq: number;
      ts: string;
      match_id: string;
      team_id: TeamId;
      type: "vote_result";
      data: {
        phase: number;
        round: number;
        result: "ACCEPT" | "AMEND" | "REJECT" | "DEADLOCK";
        tally: Record<VoteChoice, number>;
      };
    }
  | {
      id: string;
      seq: number;
      ts: string;
      match_id: string;
      team_id: TeamId;
      type: "canon_patch_applied";
      data: {
        phase: number;
        round: number;
        turn_id: string;
        patch: JsonPatchOp[];
        canon_before_hash: string;
        canon_after_hash: string;
      };
    }
  | {
      id: string;
      seq: number;
      ts: string;
      match_id: string;
      team_id: TeamId;
      type: "prompt_pack_generated";
      data: {
        prompt_pack: PromptPack;
      };
    }
  | {
      id: string;
      seq: number;
      ts: string;
      match_id: string;
      team_id: null;
      type: "match_completed";
      data: {
        canon_hash_a: string;
        canon_hash_b: string;
      };
    }
  | {
      id: string;
      seq: number;
      ts: string;
      match_id: string;
      team_id: null;
      type: "match_failed";
      data: { error: string };
    };
