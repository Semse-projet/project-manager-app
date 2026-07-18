import type {
  WorkspaceMissionType,
  WorkspaceRightPanelMode,
} from "@semse/schemas";

/**
 * Sense Workspace finite-state machine.
 *
 * The workspace tracks two orthogonal pieces of state:
 *  - the *mission* lifecycle (none → loaded → none), and
 *  - the *right panel* mode (operational ↔ configuration).
 *
 * All transitions are pure so they can be unit-tested in isolation and reused
 * by the service without side effects.
 */

export type MissionLifecycle = "none" | "loaded";

export type WorkspaceMissionAction = "load" | "unload";

const MISSION_TRANSITIONS: Record<MissionLifecycle, WorkspaceMissionAction[]> = {
  none: ["load"],
  // A mission can be replaced by loading another one, or cleared by unloading.
  loaded: ["load", "unload"],
};

/** Whether the requested mission action is allowed from the current lifecycle. */
export function canApplyMissionAction(
  current: MissionLifecycle,
  action: WorkspaceMissionAction,
): boolean {
  return MISSION_TRANSITIONS[current].includes(action);
}

/** Resolve the next mission lifecycle after applying an action. */
export function nextMissionLifecycle(
  current: MissionLifecycle,
  action: WorkspaceMissionAction,
): MissionLifecycle {
  if (!canApplyMissionAction(current, action)) {
    throw new Error(`Illegal workspace mission transition: ${current} -> ${action}`);
  }
  return action === "load" ? "loaded" : "none";
}

/**
 * When a mission is loaded the right panel always surfaces operational content
 * for that mission. Configuration is an explicit, user-driven mode.
 */
export function rightPanelModeForMission(_type: WorkspaceMissionType): WorkspaceRightPanelMode {
  return "operational";
}

/** Toggle-safe resolution of the right panel mode from an optional request. */
export function resolveRightPanelMode(
  requested: WorkspaceRightPanelMode | undefined,
  fallback: WorkspaceRightPanelMode,
): WorkspaceRightPanelMode {
  return requested ?? fallback;
}
