import type { ForgeRunState } from "./types.js";

export const forgeRunTransitions: Record<ForgeRunState, readonly ForgeRunState[]> = {
  idea: ["intake", "blocked"],
  intake: ["spec_draft", "blocked"],
  spec_draft: ["spec_review", "blocked"],
  spec_review: ["approved", "spec_draft", "blocked"],
  approved: ["planned", "blocked"],
  planned: ["building", "blocked"],
  building: ["verifying", "blocked", "rolled_back"],
  verifying: ["ready_for_review", "building", "blocked", "rolled_back"],
  ready_for_review: ["merged", "building", "blocked"],
  merged: ["deployed", "closed", "rolled_back"],
  deployed: ["observing", "rolled_back", "blocked"],
  observing: ["closed", "rolled_back", "blocked"],
  closed: [],
  blocked: ["intake", "spec_draft", "spec_review", "planned", "building", "verifying", "rolled_back"],
  rolled_back: ["spec_draft", "planned", "closed"]
};

export function canTransitionForgeRun(
  current: ForgeRunState,
  next: ForgeRunState
): boolean {
  return forgeRunTransitions[current].includes(next);
}

export function assertForgeRunTransition(
  current: ForgeRunState,
  next: ForgeRunState
): void {
  if (!canTransitionForgeRun(current, next)) {
    throw new Error(`Invalid Forge run transition: ${current} -> ${next}`);
  }
}
