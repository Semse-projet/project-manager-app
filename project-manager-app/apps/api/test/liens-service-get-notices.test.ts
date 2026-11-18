import test from "node:test";
import assert from "node:assert/strict";
import { LiensService } from "../dist/modules/liens/liens.service.js";

// getLienNotices must return every notice of the project's calendars —
// DRAFT included — without the heavy HTML body (the preview endpoint serves it).
test("getLienNotices consulta todos los avisos del proyecto, borradores incluidos", async () => {
  const calls: any[] = [];
  const prisma = {
    lienNotice: {
      async findMany(args: any) {
        calls.push(args);
        return [{ id: "draft_1", status: "DRAFT" }];
      },
    },
  };
  const service = new LiensService(prisma as never, {} as never);
  const rows = await service.getLienNotices("proj_1");

  assert.deepEqual(rows, [{ id: "draft_1", status: "DRAFT" }]);
  assert.deepEqual(calls[0].where, { lienCalendar: { projectId: "proj_1" } });
  assert.equal(calls[0].select?.noticeContent, undefined, "no debe traer el HTML del aviso");
  assert.equal(calls[0].select?.id, true);
});
