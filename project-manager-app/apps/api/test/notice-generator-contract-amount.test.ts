import test from "node:test";
import assert from "node:assert/strict";
import { NoticeGeneratorService } from "../dist/modules/liens/notice-generator.service.js";

// m2.1-lien-rights — generateNoticeFromCalendar() referenced fields that
// don't exist on the real Project model (name, address, startDate — those
// live on Project.job.title/location and Project.startAt) and hardcoded
// contractAmount:0 on every generated legal notice. Fixed 2026-08-27:
// - projectName/projectAddress now read Project.job.title/location.
// - projectStartDate now reads Project.startAt.
// - contractAmount now reads PaymentEscrow.totalAmount (the closest real
//   figure to "contract amount" in the data model — Contract itself has no
//   amount field), falling back to 0 only when there's genuinely no escrow.

function makeFakePrisma(
  input: { escrowTotalAmount?: number; jobTitle?: string | null; jobLocation?: string | null } = {},
) {
  const calendar = {
    id: "cal_1",
    stateName: "California",
    project: {
      id: "proj_1",
      startAt: new Date("2026-01-01T00:00:00.000Z"),
      job: {
        title: input.jobTitle === undefined ? "Kitchen Remodel" : input.jobTitle,
        location: input.jobLocation === undefined ? "123 Main St, San Francisco, CA 94102" : input.jobLocation,
      },
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

test("generateNoticeFromCalendar reads projectName/projectAddress from Project.job, not Project itself", async () => {
  const { prisma, getCreated } = makeFakePrisma({
    jobTitle: "Downtown Office Buildout",
    jobLocation: "500 Market St, Oakland, CA 94612",
  });
  const service = new NoticeGeneratorService(prisma as never);

  await service.generateNoticeFromCalendar("cal_1", "owner", "system");

  const notice = getCreated();
  assert.ok(notice?.noticeContent.includes("Downtown Office Buildout"), notice?.noticeContent);
  assert.ok(notice?.noticeContent.includes("500 Market St, Oakland, CA 94612"), notice?.noticeContent);
});

test("generateNoticeFromCalendar falls back to placeholder name/address only when job.title/location are genuinely missing", async () => {
  const { prisma, getCreated } = makeFakePrisma({ jobTitle: "", jobLocation: null });
  const service = new NoticeGeneratorService(prisma as never);

  await service.generateNoticeFromCalendar("cal_1", "owner", "system");

  const notice = getCreated();
  assert.ok(notice?.noticeContent.includes("Untitled Project"), notice?.noticeContent);
  assert.ok(notice?.noticeContent.includes("Unknown Address"), notice?.noticeContent);
});
