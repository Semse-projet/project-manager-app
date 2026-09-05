import test from "node:test";
import assert from "node:assert/strict";
import { WaiverController } from "../dist/modules/liens/waiver.controller.js";
import { LiensService } from "../dist/modules/liens/liens.service.js";

// m2.1-lien-rights — WaiverController.getSignUrl() called
// this.liensService.getLienWaiver(waiverId) (singular), a method that
// never existed on LiensService (only getLienWaivers, plural, with a
// different signature/purpose — all pending waivers for a project).
// Every real call to GET /v1/projects/:projectId/liens/waivers/:waiverId/
// sign-url would have thrown TypeError. Found by temporarily removing
// @ts-nocheck from waiver.controller.ts and running tsc against the real
// LiensService type — the whole liens module was suppressing this and
// three other real bugs found earlier this session. Fixed 2026-08-27 by
// adding the missing single-waiver getter to LiensService, and removing
// @ts-nocheck from this file, liens.service.ts is unaffected (already
// had it removed separately), governance.service.ts and milestones.
// repository.ts (both verified to already typecheck cleanly with no
// changes needed).

function makeFakePrisma(waiver: Record<string, unknown> | null) {
  const prisma = {
    lienWaiver: {
      async findUniqueOrThrow({ where }: { where: { id: string } }) {
        if (!waiver || waiver.id !== where.id) throw new Error("not found");
        return waiver;
      },
    },
  };
  return prisma;
}

test("getSignUrl returns the real waiver's deadline/type, not a crash", async () => {
  const waiver = {
    id: "waiver_1",
    requiredBefore: new Date("2026-09-15T00:00:00.000Z"),
    waiverType: "conditional",
  };
  const liensService = new LiensService(makeFakePrisma(waiver) as never, {} as never);
  const controller = new WaiverController(liensService);

  const result = await controller.getSignUrl("proj_1", "waiver_1");

  assert.equal(result.success, true);
  assert.equal(result.data.type, "conditional");
  assert.equal((result.data.deadline as Date).toISOString(), "2026-09-15T00:00:00.000Z");
  assert.match(result.data.signUrl, /^https:\/\/semse\.app\/sign\/waiver\/waiver_1\?token=/);
});

test("getSignUrl propagates a not-found error for an unknown waiver instead of silently succeeding", async () => {
  const liensService = new LiensService(makeFakePrisma(null) as never, {} as never);
  const controller = new WaiverController(liensService);

  await assert.rejects(() => controller.getSignUrl("proj_1", "waiver_missing"));
});
