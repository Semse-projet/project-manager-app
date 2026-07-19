import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import type {
  MissionLoadResponse,
  MissionUnloadResponse,
  NavigationUpdateResponse,
  WorkspaceActiveMission,
  WorkspaceBreadcrumbItem,
  WorkspaceContextResponse,
  WorkspaceLeftPanelState,
  WorkspaceMissionType,
  WorkspaceRightPanelMode,
} from "@semse/schemas";
import { randomUUID } from "node:crypto";
import {
  canApplyMissionAction,
  resolveRightPanelMode,
  rightPanelModeForMission,
} from "./workspace.fsm.js";

export type WorkspaceActor = {
  userId: string;
  tenantId: string;
  orgId: string;
  roles: string[];
};

type WorkspaceRightPanelState = {
  mode: WorkspaceRightPanelMode;
  content: unknown;
};

type WorkspaceState = {
  currentScreen: string;
  activeMission: WorkspaceActiveMission | null;
  leftPanel: WorkspaceLeftPanelState;
  rightPanel: WorkspaceRightPanelState;
};

export type UpdateNavigationInput = {
  leftPanelAction: string;
  centralPanelTarget?: { projectId?: string; sessionId?: string };
  rightPanelMode?: WorkspaceRightPanelMode;
};

export type LoadMissionInput = {
  missionId: string;
  missionType: WorkspaceMissionType;
  title?: string;
};

const DEFAULT_SECTION = "home";
const MAX_HISTORY = 20;

function defaultState(): WorkspaceState {
  return {
    currentScreen: DEFAULT_SECTION,
    activeMission: null,
    leftPanel: { activeSection: DEFAULT_SECTION, navigationHistory: [DEFAULT_SECTION] },
    rightPanel: { mode: "operational", content: null },
  };
}

function missionTitleFallback(type: WorkspaceMissionType): string {
  const labels: Record<WorkspaceMissionType, string> = {
    project: "Proyecto",
    conversation: "Conversación",
    budget: "Presupuesto",
    evidence: "Evidencia",
    planning: "Planificación",
  };
  return labels[type];
}

/**
 * SEMSE Workspace state coordination.
 *
 * State is per-user and process-local: it models the ephemeral three-panel UI
 * shell (left = navigation, center = active mission, right = operational vs
 * configuration context). It is intentionally not persisted — the persistent
 * layer is owned by the (separate) Prometeo Memory domain.
 */
@Injectable()
export class WorkspaceService {
  private readonly logger = new Logger(WorkspaceService.name);
  private readonly states = new Map<string, WorkspaceState>();

  private key(actor: WorkspaceActor): string {
    return `${actor.tenantId}:${actor.userId}`;
  }

  private stateFor(actor: WorkspaceActor): WorkspaceState {
    const key = this.key(actor);
    let state = this.states.get(key);
    if (!state) {
      state = defaultState();
      this.states.set(key, state);
    }
    return state;
  }

  getContext(actor: WorkspaceActor): WorkspaceContextResponse {
    const state = this.stateFor(actor);
    return {
      userId: actor.userId,
      tenantId: actor.tenantId,
      organizationId: actor.orgId,
      currentScreen: state.currentScreen,
      activeMission: state.activeMission,
      permissions: actor.roles,
      leftPanelState: { ...state.leftPanel, navigationHistory: [...state.leftPanel.navigationHistory] },
      rightPanelState: { ...state.rightPanel },
    };
  }

  updateNavigation(actor: WorkspaceActor, input: UpdateNavigationInput): NavigationUpdateResponse {
    const section = input.leftPanelAction.trim();
    if (!section) {
      throw new BadRequestException("leftPanelAction is required");
    }

    const state = this.stateFor(actor);
    state.currentScreen = section;
    state.leftPanel.activeSection = section;

    const history = state.leftPanel.navigationHistory;
    if (history[history.length - 1] !== section) {
      history.push(section);
      if (history.length > MAX_HISTORY) {
        history.splice(0, history.length - MAX_HISTORY);
      }
    }

    state.rightPanel.mode = resolveRightPanelMode(input.rightPanelMode, state.rightPanel.mode);

    const centralPanelContent = input.centralPanelTarget
      ? {
          projectId: input.centralPanelTarget.projectId ?? null,
          sessionId: input.centralPanelTarget.sessionId ?? null,
        }
      : null;

    this.logger.log(
      `workspace.navigation.changed user=${actor.userId} section=${section} rightPanel=${state.rightPanel.mode}`,
    );

    return {
      leftPanelState: { ...state.leftPanel, navigationHistory: [...history] },
      centralPanelContent,
      rightPanelContent: state.rightPanel.content,
      breadcrumb: this.buildBreadcrumb(history),
    };
  }

  loadMission(actor: WorkspaceActor, input: LoadMissionInput): MissionLoadResponse {
    const state = this.stateFor(actor);
    if (!canApplyMissionAction(state.activeMission ? "loaded" : "none", "load")) {
      throw new BadRequestException("Cannot load a mission in the current workspace state");
    }

    const title = input.title?.trim() || missionTitleFallback(input.missionType);
    const mission: WorkspaceActiveMission = {
      missionId: input.missionId,
      missionType: input.missionType,
      title,
    };
    const rightPanelMode = rightPanelModeForMission(input.missionType);

    state.activeMission = mission;
    state.rightPanel = { mode: rightPanelMode, content: { missionId: mission.missionId } };
    state.currentScreen = `mission:${input.missionType}`;

    this.logger.log(
      `workspace.mission.loaded user=${actor.userId} mission=${mission.missionId} type=${mission.missionType}`,
    );

    return {
      missionId: mission.missionId,
      missionType: mission.missionType,
      title: mission.title,
      content: { missionId: mission.missionId, missionType: mission.missionType },
      context: { section: state.leftPanel.activeSection },
      rightPanelMode,
    };
  }

  unloadMission(actor: WorkspaceActor, missionId: string): MissionUnloadResponse {
    const state = this.stateFor(actor);
    const active = state.activeMission;
    if (!active) {
      throw new BadRequestException("No active mission to unload");
    }
    if (!canApplyMissionAction("loaded", "unload")) {
      throw new BadRequestException("Cannot unload a mission in the current workspace state");
    }
    if (active.missionId !== missionId) {
      throw new BadRequestException("missionId does not match the active mission");
    }

    state.activeMission = null;
    state.rightPanel = { mode: "operational", content: null };
    state.currentScreen = state.leftPanel.activeSection;

    this.logger.log(`workspace.mission.unloaded user=${actor.userId} mission=${missionId}`);

    return { missionId, unloadedAt: new Date().toISOString() };
  }

  private buildBreadcrumb(history: string[]): WorkspaceBreadcrumbItem[] {
    return history.slice(-4).map((section) => ({
      label: section,
      path: `/workspace/${section}`,
    }));
  }

  /** Deterministic id helper (exposed for callers that need to correlate). */
  static newMissionId(): string {
    return randomUUID();
  }
}
