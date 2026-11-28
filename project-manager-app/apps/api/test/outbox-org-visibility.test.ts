import test from "node:test";
import assert from "node:assert/strict";
import {
  SYSTEM_OUTBOX_ORG_ID,
  isUsableOutboxOrgId,
  listProjectIdsVisibleToOrg,
  outboxVisibleToOrgWhere,
} from "../dist/modules/domain-events/outbox-org-visibility.js";

test("#1156: system is never a usable session org or a wildcard", () => {
  assert.equal(isUsableOutboxOrgId("org_norte"), true);
  assert.equal(isUsableOutboxOrgId(""), false);
  assert.equal(isUsableOutboxOrgId("   "), false);
  assert.equal(isUsableOutboxOrgId(SYSTEM_OUTBOX_ORG_ID), false);
});

test("#1156: outbox visibility matches the caller org plus system rows for that org's projects only", () => {
  const where = outboxVisibleToOrgWhere("org_norte", ["proj_owned", "proj_also"]);
  assert.deepEqual(where, {
    OR: [
      { orgId: "org_norte" },
      {
        orgId: "system",
        entityType: "Project",
        entityId: { in: ["proj_owned", "proj_also"] },
      },
    ],
  });
});

test("#1156: without a proven project tie, system deliveries stay hidden", () => {
  assert.deepEqual(outboxVisibleToOrgWhere("org_norte", []), {
    OR: [{ orgId: "org_norte" }],
  });
  assert.deepEqual(outboxVisibleToOrgWhere("org_norte", [""]), {
    OR: [{ orgId: "org_norte" }],
  });
});

test("#1156: a session org of system matches no outbox rows", () => {
  assert.deepEqual(outboxVisibleToOrgWhere("system", ["proj_owned"]), {
    orgId: { in: [] },
  });
  assert.deepEqual(outboxVisibleToOrgWhere("", ["proj_owned"]), {
    orgId: { in: [] },
  });
});

test("#1156: project lookup is limited to the caller as client or assigned pro", async () => {
  const calls: unknown[] = [];
  const prisma = {
    project: {
      async findMany(args: { where: unknown }) {
        calls.push(args.where);
        return [{ id: "proj_owned" }];
      },
    },
  };
  const ids = await listProjectIdsVisibleToOrg(prisma, "tenant_1", "org_norte");
  assert.deepEqual(ids, ["proj_owned"]);
  assert.deepEqual(calls[0], {
    tenantId: "tenant_1",
    OR: [
      { assignedProOrgId: "org_norte" },
      { job: { clientOrgId: "org_norte", deletedAt: null } },
    ],
  });
  assert.deepEqual(await listProjectIdsVisibleToOrg(prisma, "tenant_1", "system"), []);
});
