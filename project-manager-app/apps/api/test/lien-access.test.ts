import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { LienAccessService, assertLienAccess } from "../dist/modules/liens/lien-access.service.js";
import { WaiverController } from "../dist/modules/liens/waiver.controller.js";
import { NoticeController } from "../dist/modules/liens/notice.controller.js";
import { LiensController } from "../dist/modules/liens/liens.controller.js";

// C28 / C10 — lien endpoints were `@AuthenticatedAccess` only: any
// authenticated user of any tenant could sign ANY waiver (clearing the
// payment-release waiver gate), send certified-mail notices via Lob, create
// calendars and change statuses, and the projectId in the URL was ignored.

const PRO = "org_pro";
const CLIENT = "org_client";
const own = { clientOrgId: CLIENT, assignedProOrgId: PRO };
const actor = (over: Record<string, unknown> = {}) =>
  ({ tenantId: "t1", orgId: PRO, userId: "u1", roles: ["PRO"], ...over }) as never;

test("policy: read = client/pro/OPS_ADMIN; pro = pro/OPS_ADMIN; ops = OPS_ADMIN", () => {
  const client = actor({ orgId: CLIENT, roles: ["CLIENT"] });
  const other = actor({ orgId: "org_x" });
  const ops = actor({ orgId: "org_ops", roles: ["OPS_ADMIN"] });
  assert.doesNotThrow(() => assertLienAccess(client, own, "read"));
  assert.doesNotThrow(() => assertLienAccess(actor(), own, "read"));
  assert.doesNotThrow(() => assertLienAccess(actor(), own, "pro"));
  assert.throws(() => assertLienAccess(client, own, "pro"), ForbiddenException);
  assert.throws(() => assertLienAccess(other, own, "read"), ForbiddenException);
  assert.throws(() => assertLienAccess(actor(), own, "ops"), ForbiddenException);
  for (const m of ["read", "pro", "ops"] as const) assert.doesNotThrow(() => assertLienAccess(ops, own, m));
});

test("policy: empty orgId never matches an unassigned project (fail closed)", () => {
  assert.throws(
    () => assertLienAccess(actor({ orgId: "" }), { clientOrgId: "", assignedProOrgId: "" }, "pro"),
    ForbiddenException,
  );
});

function buildService() {
  const prisma = {
    project: {
      async findFirst({ where }: any) {
        return where.id === "proj_1" && where.tenantId === "t1"
          ? { assignedProOrgId: PRO, job: { clientOrgId: CLIENT } }
          : null;
      },
    },
    lienCalendar: { async findFirst({ where }: any) { return where.id === "cal_1" && where.projectId === "proj_1" ? { id: "cal_1" } : null; } },
    lienWaiver: { async findFirst({ where }: any) { return where.id === "w_1" && where.lienCalendar.projectId === "proj_1" ? { id: "w_1" } : null; } },
    lienNotice: { async findFirst({ where }: any) { return where.id === "n_1" && where.lienCalendar.projectId === "proj_1" ? { id: "n_1" } : null; } },
  };
  return new LienAccessService(prisma as never);
}

test("service: other tenant gets 404, other org same tenant gets 403", async () => {
  const s = buildService();
  await assert.rejects(s.assertProject(actor({ tenantId: "t2" }), "proj_1", "read"), NotFoundException);
  await assert.rejects(s.assertProject(actor({ orgId: "org_x" }), "proj_1", "read"), ForbiddenException);
  await assert.rejects(s.assertProject(actor(), "", "read"), NotFoundException);
  await s.assertProject(actor(), "proj_1", "pro");
});

test("service: a waiver/notice/calendar from another project cannot be used via this project's URL", async () => {
  const s = buildService();
  await assert.rejects(s.assertWaiver(actor(), "proj_1", "w_other", "pro"), NotFoundException);
  await assert.rejects(s.assertNotice(actor(), "proj_1", "n_other", "pro"), NotFoundException);
  await assert.rejects(s.assertCalendar(actor(), "proj_1", "cal_other", "pro"), NotFoundException);
  await s.assertWaiver(actor(), "proj_1", "w_1", "pro");
  await s.assertNotice(actor(), "proj_1", "n_1", "pro");
});

const req = (a: Record<string, unknown>) => ({ headers: {}, authContext: a }) as never;

test("signWaiver: denied actor never reaches LiensService.signWaiver (payment gate cannot be cleared)", async () => {
  let signed = 0;
  const liens = { async signWaiver() { signed++; return {}; }, async getLienWaiver() { return {}; } };
  const controller = new WaiverController(liens as never, buildService());
  const denied = [
    { tenantId: "t2", orgId: PRO, userId: "u", roles: ["PRO"] }, // other tenant
    { tenantId: "t1", orgId: "org_x", userId: "u", roles: ["PRO"] }, // other org
    { tenantId: "t1", orgId: CLIENT, userId: "u", roles: ["CLIENT"] }, // client is not the claimant
  ];
  for (const a of denied) {
    await assert.rejects(controller.signWaiver(req(a), "proj_1", "w_1", { signature: "x" }));
  }
  await assert.rejects(controller.signWaiver(req({ tenantId: "t1", orgId: PRO, userId: "u", roles: ["PRO"] }), "proj_1", "w_other", { signature: "x" }));
  assert.equal(signed, 0);
  await controller.signWaiver(req({ tenantId: "t1", orgId: PRO, userId: "u", roles: ["PRO"] }), "proj_1", "w_1", { signature: "x" });
  assert.equal(signed, 1);
});

test("sendNotice: only the project pro/OPS_ADMIN can trigger certified mail", async () => {
  let sent = 0;
  const controller = new NoticeController(
    {} as never,
    { async sendNotice() { sent++; return {}; } } as never,
    {} as never,
    buildService(),
  );
  await assert.rejects(controller.sendNotice(req({ tenantId: "t1", orgId: CLIENT, userId: "u", roles: ["CLIENT"] }), "proj_1", "n_1"));
  await assert.rejects(controller.sendNotice(req({ tenantId: "t2", orgId: PRO, userId: "u", roles: ["PRO"] }), "proj_1", "n_1"));
  assert.equal(sent, 0);
  await controller.sendNotice(req({ tenantId: "t1", orgId: PRO, userId: "u", roles: ["PRO"] }), "proj_1", "n_1");
  assert.equal(sent, 1);
});

test("updateCalendarStatus is OPS_ADMIN only", async () => {
  let updated = 0;
  const controller = new LiensController({ async updateCalendarStatus() { updated++; return {}; } } as never, buildService());
  await assert.rejects(
    controller.updateCalendarStatus(req({ tenantId: "t1", orgId: PRO, userId: "u", roles: ["PRO"] }), "proj_1", "cal_1", { newStatus: "ALERTED_30D" }),
  );
  assert.equal(updated, 0);
  await controller.updateCalendarStatus(req({ tenantId: "t1", orgId: "org_ops", userId: "u", roles: ["OPS_ADMIN"] }), "proj_1", "cal_1", { newStatus: "ALERTED_30D" });
  assert.equal(updated, 1);
});
