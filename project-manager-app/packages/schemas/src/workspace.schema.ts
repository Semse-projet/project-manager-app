import { z } from "zod";

// ── Shared enums ─────────────────────────────────────────────────────────────

export const workspaceMissionTypeSchema = z.enum([
  "project",
  "conversation",
  "budget",
  "evidence",
  "planning",
]);
export type WorkspaceMissionType = z.infer<typeof workspaceMissionTypeSchema>;

export const workspaceRightPanelModeSchema = z.enum(["operational", "configuration"]);
export type WorkspaceRightPanelMode = z.infer<typeof workspaceRightPanelModeSchema>;

// ── GET /v1/workspace/context ────────────────────────────────────────────────

export const getWorkspaceContextRequestSchema = z.object({
  sessionId: z.string().uuid().optional(),
});
export type GetWorkspaceContextRequest = z.infer<typeof getWorkspaceContextRequestSchema>;

export const workspaceActiveMissionSchema = z.object({
  missionId: z.string().uuid(),
  missionType: workspaceMissionTypeSchema,
  title: z.string(),
});
export type WorkspaceActiveMission = z.infer<typeof workspaceActiveMissionSchema>;

export const workspaceLeftPanelStateSchema = z.object({
  activeSection: z.string(),
  navigationHistory: z.array(z.string()),
});
export type WorkspaceLeftPanelState = z.infer<typeof workspaceLeftPanelStateSchema>;

export const workspaceRightPanelStateSchema = z.object({
  mode: workspaceRightPanelModeSchema,
  content: z.unknown().nullable(),
});
export type WorkspaceRightPanelState = z.infer<typeof workspaceRightPanelStateSchema>;

export const workspaceContextResponseSchema = z.object({
  userId: z.string(),
  tenantId: z.string(),
  organizationId: z.string(),
  currentScreen: z.string(),
  activeMission: workspaceActiveMissionSchema.nullable(),
  permissions: z.array(z.string()),
  leftPanelState: workspaceLeftPanelStateSchema,
  rightPanelState: workspaceRightPanelStateSchema,
});
export type WorkspaceContextResponse = z.infer<typeof workspaceContextResponseSchema>;

// ── POST /v1/workspace/navigation ────────────────────────────────────────────

export const updateNavigationRequestSchema = z.object({
  leftPanelAction: z.string().min(1),
  centralPanelTarget: z
    .object({
      projectId: z.string().uuid().optional(),
      sessionId: z.string().uuid().optional(),
    })
    .optional(),
  rightPanelMode: workspaceRightPanelModeSchema.optional(),
});
export type UpdateNavigationRequest = z.infer<typeof updateNavigationRequestSchema>;

export const workspaceBreadcrumbItemSchema = z.object({
  label: z.string(),
  path: z.string(),
});
export type WorkspaceBreadcrumbItem = z.infer<typeof workspaceBreadcrumbItemSchema>;

export const navigationUpdateResponseSchema = z.object({
  leftPanelState: workspaceLeftPanelStateSchema,
  centralPanelContent: z.unknown().nullable(),
  rightPanelContent: z.unknown().nullable(),
  breadcrumb: z.array(workspaceBreadcrumbItemSchema),
});
export type NavigationUpdateResponse = z.infer<typeof navigationUpdateResponseSchema>;

// ── POST /v1/workspace/mission/load ──────────────────────────────────────────

export const loadMissionRequestSchema = z.object({
  missionId: z.string().uuid(),
  missionType: workspaceMissionTypeSchema,
  title: z.string().min(1).max(200).optional(),
});
export type LoadMissionRequest = z.infer<typeof loadMissionRequestSchema>;

export const missionLoadResponseSchema = z.object({
  missionId: z.string().uuid(),
  missionType: workspaceMissionTypeSchema,
  title: z.string(),
  content: z.unknown().nullable(),
  context: z.unknown().nullable(),
  rightPanelMode: workspaceRightPanelModeSchema,
});
export type MissionLoadResponse = z.infer<typeof missionLoadResponseSchema>;

// ── POST /v1/workspace/mission/unload ────────────────────────────────────────

export const unloadMissionRequestSchema = z.object({
  missionId: z.string().uuid(),
});
export type UnloadMissionRequest = z.infer<typeof unloadMissionRequestSchema>;

export const missionUnloadResponseSchema = z.object({
  missionId: z.string().uuid(),
  unloadedAt: z.string(),
});
export type MissionUnloadResponse = z.infer<typeof missionUnloadResponseSchema>;
