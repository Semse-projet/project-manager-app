import test from "node:test";
import assert from "node:assert/strict";
import {
  assertMilestoneSubmittable,
  assertMilestoneApprovable,
  assertMilestoneRejectable,
} from "../src/modules/milestones/milestones.policy.ts";

const actor = {
  tenantId: "tenant_test",
  orgId: "org_pro_001",
  userId: "usr_001",
  roles: ["PRO"],
};

const clientActor = {
  tenantId: "tenant_test",
  orgId: "org_client_001",
  userId: "usr_client_001",
  roles: ["CLIENT"],
};

test("milestone submit requires evidenceCount > 0", () => {
  assert.throws(
    () =>
      assertMilestoneSubmittable(actor, {
        milestoneId: "ms_001",
        currentStatus: "draft",
        ownership: {
          clientOrgId: "org_client_001",
          assignedProOrgId: "org_pro_001",
        },
        evidenceCount: 0,
      }),
    /without evidence/i
  );
});

test("milestone submit accepts draft with evidence", () => {
  assert.doesNotThrow(() =>
    assertMilestoneSubmittable(actor, {
      milestoneId: "ms_002",
      currentStatus: "draft",
      ownership: {
        clientOrgId: "org_client_001",
        assignedProOrgId: "org_pro_001",
      },
      evidenceCount: 1,
    })
  );
});

test("milestone approve requires submitted status and client ownership", () => {
  assert.throws(
    () =>
      assertMilestoneApprovable(actor, {
        milestoneId: "ms_003",
        currentStatus: "draft",
        ownership: {
          clientOrgId: "org_client_001",
          assignedProOrgId: "org_pro_001",
        },
        evidenceCount: 1,
      }),
    /cannot approve this milestone/i
  );

  assert.throws(
    () =>
      assertMilestoneApprovable(clientActor, {
        milestoneId: "ms_003b",
        currentStatus: "draft",
        ownership: {
          clientOrgId: "org_client_001",
          assignedProOrgId: "org_pro_001",
        },
        evidenceCount: 1,
      }),
    /cannot approve milestone in status 'draft'/i
  );

  assert.doesNotThrow(() =>
    assertMilestoneApprovable(clientActor, {
      milestoneId: "ms_004",
      currentStatus: "submitted",
      ownership: {
        clientOrgId: "org_client_001",
        assignedProOrgId: "org_pro_001",
      },
      evidenceCount: 2,
    })
  );
});

test("milestone reject requires client ownership and non-paid status", () => {
  assert.throws(
    () =>
      assertMilestoneRejectable(actor, {
        milestoneId: "ms_005",
        currentStatus: "submitted",
        ownership: {
          clientOrgId: "org_client_001",
          assignedProOrgId: "org_pro_001",
        },
        evidenceCount: 2,
      }),
    /cannot reject this milestone/i
  );

  assert.throws(
    () =>
      assertMilestoneRejectable(clientActor, {
        milestoneId: "ms_006",
        currentStatus: "paid",
        ownership: {
          clientOrgId: "org_client_001",
          assignedProOrgId: "org_pro_001",
        },
        evidenceCount: 2,
      }),
    /cannot reject milestone in paid status/i
  );
});
