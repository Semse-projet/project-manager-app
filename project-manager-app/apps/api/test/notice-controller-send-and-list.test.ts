import test from "node:test";
import assert from "node:assert/strict";
import { NoticeController } from "../dist/modules/liens/notice.controller.js";

// m2.1-lien-rights — found 2026-08-27 while wiring LiensModule into
// AppModule (it was never registered there at all, so none of this module
// was previously reachable by any real request):
//
// 1. GET /v1/projects/:projectId/liens/notices always returned a hardcoded
//    empty array — `for (const _calendar of calendars) { ... Promise.resolve([]) }`
//    — regardless of what notices actually existed in the DB.
// 2. POST /v1/projects/:projectId/liens/notices/:noticeId/send called
//    NoticeGeneratorService.updateNoticeStatus(noticeId, 'NOTICE_SENT'),
//    which only flips the DB status column. It never called
//    NoticeSendService (the only code in this module that actually talks
//    to Lob.com to mail a certified letter), so a caller of this endpoint
//    got back "Notice marked as sent" for a legally-required notice that
//    was never physically mailed.
//
// Both fixed: getNotices() now flattens the notices already returned by
// getLienCalendars()'s include; sendNotice() now delegates to
// NoticeSendService.sendNotice().

function makeFakeLiensService(calendars: unknown[]) {
  return {
    async getLienCalendars(_projectId: string) {
      return calendars;
    },
  };
}

function makeFakeNoticeSendService(result: unknown, calls: string[]) {
  return {
    async sendNotice(noticeId: string) {
      calls.push(noticeId);
      return result;
    },
  };
}

test("getNotices flattens notices already included on each calendar instead of returning a hardcoded []", async () => {
  const calendars = [
    { id: "cal_1", notices: [{ id: "notice_1", status: "NOTICE_SENT" }] },
    { id: "cal_2", notices: [{ id: "notice_2", status: "NOTICE_DELIVERED" }, { id: "notice_3", status: "DELIVERY_FAILED" }] },
  ];
  const controller = new NoticeController(
    {} as never,
    {} as never,
    makeFakeLiensService(calendars) as never,
  );

  const result = await controller.getNotices("proj_1");

  assert.equal(result.count, 3);
  assert.deepEqual(
    result.data.map((n: { id: string }) => n.id),
    ["notice_1", "notice_2", "notice_3"],
  );
});

test("getNotices tolerates a calendar with no notices array", async () => {
  const calendars = [{ id: "cal_1" }];
  const controller = new NoticeController(
    {} as never,
    {} as never,
    makeFakeLiensService(calendars) as never,
  );

  const result = await controller.getNotices("proj_1");

  assert.equal(result.count, 0);
  assert.deepEqual(result.data, []);
});

test("sendNotice delegates to NoticeSendService.sendNotice (real Lob.com send) instead of just flipping status", async () => {
  const calls: string[] = [];
  const sentNotice = { id: "notice_1", status: "NOTICE_SENT", lobLetterTrackingId: "ltr_mock_1" };
  const controller = new NoticeController(
    {} as never,
    makeFakeNoticeSendService(sentNotice, calls) as never,
    {} as never,
  );

  const result = await controller.sendNotice("proj_1", "notice_1");

  assert.deepEqual(calls, ["notice_1"]);
  assert.equal(result.success, true);
  assert.equal(result.data, sentNotice);
  assert.ok(!result.message.includes("Bloque W"), result.message);
});

test("sendNotice propagates NoticeSendService's fail-closed address error instead of swallowing it", async () => {
  const controller = new NoticeController(
    {} as never,
    {
      async sendNotice() {
        throw new Error("Cannot send notice notice_1: project job location is missing");
      },
    } as never,
    {} as never,
  );

  await assert.rejects(
    () => controller.sendNotice("proj_1", "notice_1"),
    /project job location is missing/,
  );
});
