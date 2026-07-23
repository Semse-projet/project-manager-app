import test from "node:test";
import assert from "node:assert/strict";
import {
  loadMissionRequestSchema,
  unloadMissionRequestSchema,
  workspaceActiveMissionSchema,
  copilotMessageRequestSchema,
  copilotMessageResponseSchema,
  createMissionFromCopilotRequestSchema,
  missionCreationResponseSchema,
  actionExecutionResponseSchema,
  prometeoOrchestrationResponseSchema,
  orchestrationStatusResponseSchema,
  agentConsultationResponseSchema,
} from "@semse/schemas";

const UUID = "3f0d2c1e-5b6a-4c7d-8e9f-0a1b2c3d4e5f";

test("loadMissionRequestSchema requires a UUID missionId", () => {
  assert.ok(
    loadMissionRequestSchema.safeParse({ missionId: UUID, missionType: "project" }).success,
  );
  assert.equal(
    loadMissionRequestSchema.safeParse({ missionId: "mission-123", missionType: "project" })
      .success,
    false,
  );
});

test("unloadMissionRequestSchema requires a UUID missionId", () => {
  assert.ok(unloadMissionRequestSchema.safeParse({ missionId: UUID }).success);
  assert.equal(unloadMissionRequestSchema.safeParse({ missionId: "abc" }).success, false);
});

test("workspaceActiveMissionSchema requires a UUID missionId", () => {
  assert.ok(
    workspaceActiveMissionSchema.safeParse({
      missionId: UUID,
      missionType: "budget",
      title: "T",
    }).success,
  );
  assert.equal(
    workspaceActiveMissionSchema.safeParse({
      missionId: "not-uuid",
      missionType: "budget",
      title: "T",
    }).success,
    false,
  );
});

test("copilot message sessionId is an optional UUID on request and required UUID on response", () => {
  assert.ok(copilotMessageRequestSchema.safeParse({ message: "hola" }).success);
  assert.ok(copilotMessageRequestSchema.safeParse({ message: "hola", sessionId: UUID }).success);
  assert.equal(
    copilotMessageRequestSchema.safeParse({ message: "hola", sessionId: "sess-1" }).success,
    false,
  );
  assert.equal(
    copilotMessageResponseSchema.shape.sessionId.safeParse("sess-1").success,
    false,
  );
  assert.ok(copilotMessageResponseSchema.shape.sessionId.safeParse(UUID).success);
});

test("createMissionFromCopilotRequestSchema requires a UUID copilotSessionId", () => {
  assert.equal(
    createMissionFromCopilotRequestSchema.shape.copilotSessionId.safeParse("sess-1").success,
    false,
  );
  assert.ok(createMissionFromCopilotRequestSchema.shape.copilotSessionId.safeParse(UUID).success);
});

test("copilot response ids are UUIDs", () => {
  assert.ok(missionCreationResponseSchema.shape.missionId.safeParse(UUID).success);
  assert.equal(missionCreationResponseSchema.shape.missionId.safeParse("m1").success, false);
  assert.ok(actionExecutionResponseSchema.shape.actionId.safeParse(UUID).success);
  assert.equal(actionExecutionResponseSchema.shape.actionId.safeParse("a1").success, false);
});

test("orchestration response ids are UUIDs", () => {
  assert.ok(prometeoOrchestrationResponseSchema.shape.orchestrationId.safeParse(UUID).success);
  assert.equal(
    prometeoOrchestrationResponseSchema.shape.orchestrationId.safeParse("orch-1").success,
    false,
  );
  assert.ok(orchestrationStatusResponseSchema.shape.orchestrationId.safeParse(UUID).success);
  assert.equal(
    orchestrationStatusResponseSchema.shape.orchestrationId.safeParse("orch-1").success,
    false,
  );
  assert.ok(agentConsultationResponseSchema.shape.consultationId.safeParse(UUID).success);
  assert.equal(
    agentConsultationResponseSchema.shape.consultationId.safeParse("c1").success,
    false,
  );
});
