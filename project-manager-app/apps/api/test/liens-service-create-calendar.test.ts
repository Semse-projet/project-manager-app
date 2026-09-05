import test from "node:test";
import assert from "node:assert/strict";
import { LiensService } from "../dist/modules/liens/liens.service.js";

// m2.1-lien-rights — LiensService.createLienCalendar() selected
// `project.address`, a field that doesn't exist on the real Project model
// (verified against packages/db/prisma/schema.prisma and Prisma's own
// generated types). This is the live POST
// /v1/projects/:projectId/liens/calendar endpoint — every real call would
// have been rejected by Prisma's query validation before reaching any of
// this method's logic, and nothing in this module's test suite caught it
// because the existing tests reimplement the logic inline instead of
// calling the real service. Fixed 2026-08-27: selects project.job.location.

function makeFakePrisma(input: { existingCalendar?: unknown; jobLocation?: string | null } = {}) {
  const created: unknown[] = [];
  const prisma = {
    project: {
      async findUniqueOrThrow() {
        return { id: "proj_1", tenantId: "tenant_1", job: { location: input.jobLocation ?? "123 Main St, San Francisco, CA 94102" } };
      },
    },
    lienCalendar: {
      async findUnique() {
        return input.existingCalendar ?? null;
      },
      async create(args: { data: Record<string, unknown> }) {
        const row = { id: "cal_1", ...args.data };
        created.push(row);
        return row;
      },
    },
  };
  return { prisma, getCreated: () => created };
}

function makeFakeLienGridClient(calls: unknown[] = []) {
  return {
    async getDeadlines(input: unknown) {
      calls.push(input);
      return {
        preliminaryNoticeDeadline: "2026-09-01T00:00:00.000Z",
        waiverDeadline: "2026-09-15T00:00:00.000Z",
        finalNoticeDeadline: null,
        statusLienDeadline: null,
        requiresNotary: false,
        requiresCertifiedMail: true,
      };
    },
  };
}

test("createLienCalendar succeeds end-to-end and forwards the project's real job location to LienGrid", async () => {
  const { prisma, getCreated } = makeFakePrisma({ jobLocation: "500 Market St, Oakland, CA 94612" });
  const lienGridCalls: unknown[] = [];
  const service = new LiensService(prisma as never, makeFakeLienGridClient(lienGridCalls) as never);

  const calendar = await service.createLienCalendar("proj_1", "CA", new Date("2026-06-01T00:00:00.000Z"));

  assert.equal(calendar.stateName, "CA");
  assert.equal(getCreated().length, 1);
  assert.equal((lienGridCalls[0] as { address: string }).address, "500 Market St, Oakland, CA 94612");
});

test("createLienCalendar returns the existing calendar without calling LienGrid when one already exists", async () => {
  const existing = { id: "cal_existing", stateName: "CA" };
  const { prisma } = makeFakePrisma({ existingCalendar: existing });
  const lienGridCalls: unknown[] = [];
  const service = new LiensService(prisma as never, makeFakeLienGridClient(lienGridCalls) as never);

  const calendar = await service.createLienCalendar("proj_1", "CA", new Date("2026-06-01T00:00:00.000Z"));

  assert.equal(calendar.id, "cal_existing");
  assert.equal(lienGridCalls.length, 0);
});
