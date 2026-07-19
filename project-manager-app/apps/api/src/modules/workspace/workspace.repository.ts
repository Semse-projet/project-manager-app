import { Injectable, Logger } from "@nestjs/common";
import type {
  WorkspaceActiveMission,
  WorkspaceMissionType,
  WorkspaceRightPanelMode,
} from "@semse/schemas";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

export type PersistedWorkspaceState = {
  currentScreen: string;
  activeSection: string;
  navigationHistory: string[];
  rightPanelMode: WorkspaceRightPanelMode;
  activeMission: WorkspaceActiveMission | null;
};

export interface WorkspaceStateRepository {
  load(tenantId: string, userId: string): Promise<PersistedWorkspaceState | null>;
  save(tenantId: string, userId: string, state: PersistedWorkspaceState): Promise<void>;
}

export const WORKSPACE_STATE_REPOSITORY = Symbol("WORKSPACE_STATE_REPOSITORY");

/** In-memory repository — used by unit tests and as a degradation fallback. */
export class InMemoryWorkspaceStateRepository implements WorkspaceStateRepository {
  private readonly states = new Map<string, PersistedWorkspaceState>();

  private key(tenantId: string, userId: string): string {
    return `${tenantId}:${userId}`;
  }

  async load(tenantId: string, userId: string): Promise<PersistedWorkspaceState | null> {
    return this.states.get(this.key(tenantId, userId)) ?? null;
  }

  async save(tenantId: string, userId: string, state: PersistedWorkspaceState): Promise<void> {
    this.states.set(this.key(tenantId, userId), {
      ...state,
      navigationHistory: [...state.navigationHistory],
      activeMission: state.activeMission ? { ...state.activeMission } : null,
    });
  }
}

/**
 * Prisma-backed persistence. Degrades gracefully to an in-memory store when the
 * database is unreachable, mirroring PrismaService's non-blocking posture so the
 * API keeps working locally (and on Railway boot) without a database.
 */
@Injectable()
export class PrismaWorkspaceStateRepository implements WorkspaceStateRepository {
  private readonly logger = new Logger(PrismaWorkspaceStateRepository.name);
  private readonly fallback = new InMemoryWorkspaceStateRepository();
  private degraded = false;

  constructor(private readonly prisma: PrismaService) {}

  async load(tenantId: string, userId: string): Promise<PersistedWorkspaceState | null> {
    try {
      const row = await this.prisma.prometeoWorkspaceState.findUnique({
        where: { tenantId_userId: { tenantId, userId } },
      });
      if (!row) {
        return null;
      }
      return {
        currentScreen: row.currentScreen,
        activeSection: row.activeSection,
        navigationHistory: [...row.navigationHistory],
        rightPanelMode: row.rightPanelMode as WorkspaceRightPanelMode,
        activeMission: row.activeMissionId
          ? {
              missionId: row.activeMissionId,
              missionType: row.activeMissionType as WorkspaceMissionType,
              title: row.activeMissionTitle ?? "",
            }
          : null,
      };
    } catch (error) {
      this.degrade(error);
      return this.fallback.load(tenantId, userId);
    }
  }

  async save(tenantId: string, userId: string, state: PersistedWorkspaceState): Promise<void> {
    const data = {
      currentScreen: state.currentScreen,
      activeSection: state.activeSection,
      navigationHistory: state.navigationHistory,
      rightPanelMode: state.rightPanelMode,
      activeMissionId: state.activeMission?.missionId ?? null,
      activeMissionType: state.activeMission?.missionType ?? null,
      activeMissionTitle: state.activeMission?.title ?? null,
    };
    try {
      await this.prisma.prometeoWorkspaceState.upsert({
        where: { tenantId_userId: { tenantId, userId } },
        create: { tenantId, userId, ...data },
        update: data,
      });
    } catch (error) {
      this.degrade(error);
      await this.fallback.save(tenantId, userId, state);
    }
  }

  private degrade(error: unknown): void {
    if (!this.degraded) {
      this.degraded = true;
      this.logger.warn(
        `Prometeo workspace state persistence degraded to in-memory: ${(error as Error)?.message ?? String(error)}`,
      );
    }
  }
}
