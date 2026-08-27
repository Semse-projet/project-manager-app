import test from "node:test";
import assert from "node:assert/strict";
import { NoticeGeneratorService } from "../dist/modules/liens/notice-generator.service.js";

// m2.1-lien-rights — generateNoticeFromCalendar() hardcoded contractAmount:0
// on every generated legal notice, regardless of the project's real funded
// amount. Fixed 2026-08-27 to read PaymentEscrow.totalAmount (the closest
// real figure to "contract amount" in the data model — Contract itself has
// no amount field).

function makeFakePrisma(input: { escrowTotalAmount?: number } = {}) {
  const calendar = {
    id: "cal_1",
    stateName: "California",
    project: {
      id: "proj_1",
      name: "Kitchen Remodel",
      address: "123 Main St, San Francisco, CA",
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      escrow:
        input.escrowTotalAmount === undefined
          ? null
          : { totalAmount: { toNumber: () => input.escrowTotalAmount } },
    },
  };
  let created: unknown;
  const prisma = {
    lienCalendar: {
      async findUniqueOrThrow() {
        return calendar;
      },
    },
    lienNotice: {
      async create(args: { data: unknown }) {
        created = args.data;
        return { id: "notice_1", ...args.data };
      },
    },
  };
  return { prisma, getCreated: () => created as { noticeContent: string } | undefined };
}

test("generateNoticeFromCalendar uses the project's real escrow.totalAmount as contractAmount", async () => {
  const { prisma, getCreated } = makeFakePrisma({ escrowTotalAmount: 87_500 });
  const service = new NoticeGeneratorService(prisma as never);

  await service.generateNoticeFromCalendar("cal_1", "owner", "system");

  const notice = getCreated();
  assert.ok(notice?.noticeContent.includes("Contract Amount:</strong> $87500"), notice?.noticeContent);
});

test("generateNoticeFromCalendar falls back to contractAmount=0 only when the project genuinely has no escrow", async () => {
  const { prisma, getCreated } = makeFakePrisma({});
  const service = new NoticeGeneratorService(prisma as never);

  await service.generateNoticeFromCalendar("cal_1", "owner", "system");

  const notice = getCreated();
  assert.ok(notice?.noticeContent.includes("Contract Amount:</strong> $0"), notice?.noticeContent);
});
