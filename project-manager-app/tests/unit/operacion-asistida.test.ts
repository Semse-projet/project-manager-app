import test from "node:test";
import assert from "node:assert/strict";
import { executeGovernedAgentRun } from "@semse/agents";
import { opsAgentRuntimeQuerySchema } from "@semse/schemas";

test("ops agent runtime query accepts assisted-operation filters", () => {
  const parsed = opsAgentRuntimeQuerySchema.parse({
    workspaceId: "workspace-ops",
    operatorId: "usr_ops",
    memoryTag: "agent-runtime",
    limit: "25"
  });

  assert.equal(parsed.workspaceId, "workspace-ops");
  assert.equal(parsed.operatorId, "usr_ops");
  assert.equal(parsed.memoryTag, "agent-runtime");
  assert.equal(parsed.limit, 25);
});

test("governed agent runtime emits operator context audit trail", () => {
  const result = executeGovernedAgentRun({
    agentType: "risk",
    runId: "run_operacion_asistida_unit",
    correlationId: "corr_operacion_asistida_unit",
    payload: {
      scope: "Validate assisted operation context auditability",
      budgetCents: 500000,
      operatorContext: {
        version: "v1",
        source: "user_session",
        scope: "workspace",
        operatorId: "usr_ops",
        tenantId: "tnt_ops",
        orgId: "org_ops",
        roles: ["OPS_ADMIN"],
        workspaceId: "workspace-ops"
      }
    },
    environment: "worker"
  });

  const audit = result.auditTrail.find((entry) => entry.type === "agent.operator_context");
  assert.ok(audit, "operator context should be included in audit trail");
  assert.equal(audit.detail.operatorId, "usr_ops");
  assert.equal(audit.detail.workspaceId, "workspace-ops");
});
