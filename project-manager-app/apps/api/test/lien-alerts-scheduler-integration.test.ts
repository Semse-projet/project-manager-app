import test from "node:test";
import assert from "node:assert/strict";
import { LienAlertsScheduler } from "../dist/modules/liens/lien-alerts.scheduler.js";
import { LiensService } from "../dist/modules/liens/liens.service.js";
import { NoticeGeneratorService } from "../dist/modules/liens/notice-generator.service.js";

// m2.1-lien-rights — checkAndAlertDeadlines() selected `project.name` and
// `project.address` in its Prisma `select`, but neither field exists on the
// real Project model (verified against packages/db/prisma/schema.prisma
// and against Prisma's own generated types via tsc). Every real invocation
// of this method — including the hourly automated one wired into
// apps/worker/src/main.mjs this session — would have been rejected by
// Prisma's query validation before ever reaching the FSM logic below, which
// the rest of this module's test suite (bloque-u-liens-automation.test.ts)
// never caught because it reimplements the threshold/FSM logic inline
// instead of exercising the real class end-to-end. Fixed 2026-08-27:
// selects project.job.title instead.

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function makeFakePrisma(calendars: Array<Record<string, unknown>>) {
  const updateCalls: Array<{ id: string; status: string }> = [];
  const prisma = {
    lienCalendar: {
      async findMany() {
        return calendars;
      },
      async findUniqueOrThrow({ where }: { where: { id: string } }) {
        const found = calendars.find((c) => c.id === where.id);
        if (!found) throw new Error("not found");
        return found;
      },
      async update({ where, data }: { where: { id: string }; data: { status: string } }) {
        const found = calendars.find((c) => c.id === where.id) as { status: string };
        found.status = data.status;
        updateCalls.push({ id: where.id, status: data.status });
        return found;
      },
    },
  };
  return { prisma, updateCalls };
}

test("checkAndAlertDeadlines runs end-to-end without Prisma rejecting the query shape", async () => {
  const calendar = {
    id: "cal_1",
    status: "CREATED",
    preliminaryNoticeDeadline: daysFromNow(25),
    project: { id: "proj_1", tenantId: "tenant_1", job: { title: "Kitchen Remodel" } },
  };
  const { prisma, updateCalls } = makeFakePrisma([calendar]);
  const liensService = new LiensService(prisma as never, {} as never);
  const noticeGeneratorService = new NoticeGeneratorService(prisma as never);
  const scheduler = new LienAlertsScheduler(prisma as never, liensService, noticeGeneratorService);

  await scheduler.checkAndAlertDeadlines();

  assert.deepEqual(updateCalls, [{ id: "cal_1", status: "ALERTED_30D" }]);
  assert.equal(calendar.status, "ALERTED_30D");
});

test("checkAndAlertDeadlines does not transition a calendar outside its threshold", async () => {
  const calendar = {
    id: "cal_1",
    status: "CREATED",
    preliminaryNoticeDeadline: daysFromNow(45),
    project: { id: "proj_1", tenantId: "tenant_1", job: { title: "Kitchen Remodel" } },
  };
  const { prisma, updateCalls } = makeFakePrisma([calendar]);
  const liensService = new LiensService(prisma as never, {} as never);
  const noticeGeneratorService = new NoticeGeneratorService(prisma as never);
  const scheduler = new LienAlertsScheduler(prisma as never, liensService, noticeGeneratorService);

  await scheduler.checkAndAlertDeadlines();

  assert.deepEqual(updateCalls, []);
  assert.equal(calendar.status, "CREATED");
});
