import { applyPatch, type Operation } from "fast-json-patch";
import type { Canon, MatchEvent, TeamId } from "@wba/contracts";

/**
 * Derives the current canon state for a team by replaying all patches from events.
 * This is a port of the Python canon derivation logic.
 */
export function deriveTeamCanon(
  events: MatchEvent[],
  teamId: TeamId
): Canon | null {
  // Find the initial canon for this team
  const initEvent = events.find(
    (e) => e.type === "canon_initialized" && e.team_id === teamId
  );

  if (!initEvent || initEvent.type !== "canon_initialized") {
    return null;
  }

  // Start with a deep copy of the initial canon
  let canon = structuredClone(initEvent.data.canon);

  // Apply all patches in order
  for (const event of events) {
    if (event.type !== "canon_patch_applied" || event.team_id !== teamId) {
      continue;
    }

    const patch = event.data.patch as Operation[];
    try {
      const result = applyPatch(canon, patch, false, false);
      canon = result.newDocument;
    } catch (err) {
      console.error("Failed to apply patch:", err, patch);
    }
  }

  return canon;
}

/**
 * Get the canon state before the last patch was applied.
 * Useful for diff views.
 */
export function deriveTeamCanonBefore(
  events: MatchEvent[],
  teamId: TeamId
): Canon | null {
  // Find all patch events for this team
  const patchEvents = events.filter(
    (e) => e.type === "canon_patch_applied" && e.team_id === teamId
  );

  if (patchEvents.length === 0) {
    // No patches yet, return initial canon
    const initEvent = events.find(
      (e) => e.type === "canon_initialized" && e.team_id === teamId
    );
    if (!initEvent || initEvent.type !== "canon_initialized") {
      return null;
    }
    return structuredClone(initEvent.data.canon);
  }

  // Replay all patches except the last one
  const eventsWithoutLastPatch = events.filter(
    (e) =>
      !(
        e.type === "canon_patch_applied" &&
        e.team_id === teamId &&
        e.seq === patchEvents[patchEvents.length - 1].seq
      )
  );

  return deriveTeamCanon(eventsWithoutLastPatch, teamId);
}
