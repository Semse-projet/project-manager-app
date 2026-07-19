import { BadRequestException, Inject, Injectable, Logger } from "@nestjs/common";
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
import {
  WORKSPACE_STATE_REPOSITORY,
  type PersistedWorkspaceState,
  type WorkspaceStateRepository,
} from "./workspace.repository.js";

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

function toWorkspaceState(persisted: PersistedWorkspaceState): WorkspaceState {
  return {
    currentScreen: persisted.currentScreen,
    activeMission: persisted.activeMission ? { ...persisted.activeMission } : null,
    leftPanel: {
      activeSection: persisted.activeSection,
      navigationHistory: [...persisted.navigationHistory],
    },
    rightPanel: {
      mode: persisted.rightPanelMode,
      content: persisted.activeMission ? { missionId: persisted.activeMission.missionId } : null,
    },
  };
}

function toPersisted(state: WorkspaceState): PersistedWorkspaceState {
  return {
    currentScreen: state.currentScreen,
    activeSection: state.leftPanel.activeSection,
    navigationHistory: [...state.leftPanel.navigationHistory],
    rightPanelMode: state.rightPanel.mode,
    activeMission: state.activeMission ? { ...state.activeMission } : null,
  };
}

/**
 * SEMSE Workspace state coordination.
 *
 * State models the three-panel UI shell (left = navigation, center = active
 * mission, right = operational vs configuration context). It is persisted per
 * (tenant, user) by the Prometeo Memory layer so it survives restarts and is
 * shared across API replicas; the repository degrades to memory when the
 * database is unavailable.
 */
@Injectable()
export class WorkspaceService {
  private readonly logger = new Logger(WorkspaceService.name);

  constructor(
    @Inject(WORKSPACE_STATE_REPOSITORY)
    private readonly repository: WorkspaceStateRepository,
  ) {}

  private async stateFor(actor: WorkspaceActor): Promise<WorkspaceState> {
    const persisted = await this.repository.load(actor.tenantId, actor.userId);
    return persisted ? toWorkspaceState(persisted) : defaultState();
  }

  private async persist(actor: WorkspaceActor, state: WorkspaceState): Promise<void> {
    await this.repository.save(actor.tenantId, actor.userId, toPersisted(state));
  }

  async getContext(actor: WorkspaceActor): Promise<WorkspaceContextResponse> {
    const state = await this.stateFor(actor);
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

  async updateNavigation(
    actor: WorkspaceActor,
    input: UpdateNavigationInput,
  ): Promise<NavigationUpdateResponse> {
    const section = input.leftPanelAction.trim();
    if (!section) {
      throw new BadRequestException("leftPanelAction is required");
    }

    const state = await this.stateFor(actor);
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

    await this.persist(actor, state);

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

  async loadMission(actor: WorkspaceActor, input: LoadMissionInput): Promise<MissionLoadResponse> {
    const state = await this.stateFor(actor);
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

    await this.persist(actor, state);

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

  async unloadMission(actor: WorkspaceActor, missionId: string): Promise<MissionUnloadResponse> {
    const state = await this.stateFor(actor);
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

    await this.persist(actor, state);

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
