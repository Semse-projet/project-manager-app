import assert from "node:assert/strict";
import test from "node:test";
import { assertDisputeResolvable } from "../src/modules/disputes/disputes.policy.ts";

const ownership = {
  clientOrgId: "org_client",
  assignedProOrgId: "org_pro",
};

test("cliente dueño puede cerrar por acuerdo solo a favor del profesional", () => {
  const client = {
    tenantId: "tenant_1",
    orgId: "org_client",
    userId: "user_client",
    roles: ["CLIENT"],
  };

  assert.doesNotThrow(() => assertDisputeResolvable(client, ownership, "OPEN", "pro_favor"));
  assert.throws(
    () => assertDisputeResolvable(client, ownership, "OPEN", "client_favor"),
    /cannot resolve/i,
  );
  assert.throws(
    () => assertDisputeResolvable(client, ownership, "OPEN", "partial_50_50"),
    /cannot resolve/i,
  );
});

test("OPS puede aplicar cualquier tipo de resolución no terminal", () => {
  const ops = {
    tenantId: "tenant_1",
    orgId: "org_ops",
    userId: "user_ops",
    roles: ["OPS_ADMIN"],
  };

  for (const resolutionType of ["client_favor", "pro_favor", "partial_50_50", "escalated_legal"]) {
    assert.doesNotThrow(() => assertDisputeResolvable(ops, ownership, "UNDER_REVIEW", resolutionType));
  }
});

test("una disputa terminal no puede resolverse de nuevo", () => {
  const ops = {
    tenantId: "tenant_1",
    orgId: "org_ops",
    userId: "user_ops",
    roles: ["OPS_ADMIN"],
  };

  assert.throws(
    () => assertDisputeResolvable(ops, ownership, "RESOLVED", "pro_favor"),
    /already terminal/i,
  );
  assert.throws(
    () => assertDisputeResolvable(ops, ownership, "REJECTED", "pro_favor"),
    /already terminal/i,
  );
});
