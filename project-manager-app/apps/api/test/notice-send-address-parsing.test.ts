import test from "node:test";
import assert from "node:assert/strict";
import { NoticeSendService, parseMailAddress } from "../dist/modules/liens/notice-send.service.js";

// m2.1-lien-rights — NoticeSendService.sendNotice() hardcoded city:"City"
// and zip:"12345" on every real certified letter sent via Lob.com, and read
// notice.lienCalendar.project.address, a field that doesn't exist on the
// real Project model (address lives on Project.job.location) — every real
// letter would have mailed to a fake, undeliverable destination. Fixed
// 2026-08-27: parses the real address into Lob's structured fields, and
// refuses to send (throws) rather than mail to a guessed/placeholder
// address when the location is missing or unparseable.

test("parseMailAddress extracts street/city/state/zip from the standard format", () => {
  const parsed = parseMailAddress("123 Main St, San Francisco, CA 94102");
  assert.deepEqual(parsed, {
    addressLine1: "123 Main St",
    city: "San Francisco",
    state: "CA",
    zip: "94102",
  });
});

test("parseMailAddress accepts a ZIP+4", () => {
  const parsed = parseMailAddress("500 Market St, Oakland, CA 94612-1234");
  assert.equal(parsed?.zip, "94612-1234");
});

test("parseMailAddress returns null for missing, empty, or unparseable input", () => {
  assert.equal(parseMailAddress(null), null);
  assert.equal(parseMailAddress(undefined), null);
  assert.equal(parseMailAddress(""), null);
  assert.equal(parseMailAddress("some freeform text with no structure"), null);
  assert.equal(parseMailAddress("123 Main St, San Francisco"), null); // missing state/zip
});

function makeFakePrisma(jobLocation: string | null) {
  const notice = {
    id: "notice_1",
    status: "DRAFT",
    recipientType: "owner",
    noticeContent: "<html></html>",
    lienCalendar: {
      stateName: "California",
      project: { job: { location: jobLocation } },
    },
  };
  const updates: unknown[] = [];
  const prisma = {
    lienNotice: {
      async findUniqueOrThrow() {
        return notice;
      },
      async update(args: { data: unknown }) {
        updates.push(args.data);
        return { ...notice, ...args.data };
      },
    },
  };
  return { prisma, getUpdates: () => updates };
}

function makeFakeLobClient(calls: unknown[]) {
  return {
    async sendLetter(request: unknown) {
      calls.push(request);
      return { id: "ltr_1", url: "https://lob.test/ltr_1", status: "processing" };
    },
  };
}

type SendLetterCall = { to: { name: string; address_line1: string; city: string; state: string; zip: string } };

test("sendNotice refuses to mail a notice when the project job has no location", async () => {
  const { prisma } = makeFakePrisma(null);
  const lobCalls: unknown[] = [];
  const service = new NoticeSendService(prisma as never, makeFakeLobClient(lobCalls) as never);

  await assert.rejects(() => service.sendNotice("notice_1"), /refusing to mail/i);
  assert.equal(lobCalls.length, 0);
});

test("sendNotice refuses to mail a notice when the location is freeform/unparseable", async () => {
  const { prisma } = makeFakePrisma("somewhere near the job site");
  const lobCalls: unknown[] = [];
  const service = new NoticeSendService(prisma as never, makeFakeLobClient(lobCalls) as never);

  await assert.rejects(() => service.sendNotice("notice_1"), /refusing to mail/i);
  assert.equal(lobCalls.length, 0);
});

test("sendNotice mails to the real parsed address, not a placeholder", async () => {
  const { prisma } = makeFakePrisma("123 Main St, San Francisco, CA 94102");
  const lobCalls: SendLetterCall[] = [];
  const service = new NoticeSendService(prisma as never, makeFakeLobClient(lobCalls) as never);

  await service.sendNotice("notice_1");

  assert.equal(lobCalls.length, 1);
  assert.deepEqual(lobCalls[0].to, {
    name: "Property Owner",
    address_line1: "123 Main St",
    city: "San Francisco",
    state: "CA",
    zip: "94102",
  });
});
