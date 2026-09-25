import { resolveWorkerNotificationTarget } from "./pushNotificationTargets";

it("returns null when there is no data", () => {
  expect(resolveWorkerNotificationTarget(undefined)).toBeNull();
  expect(resolveWorkerNotificationTarget(null)).toBeNull();
});

it("returns null for proximity notifications (kind, not type)", () => {
  expect(resolveWorkerNotificationTarget({ kind: "ask", siteKind: "job", siteId: "job1" })).toBeNull();
});

it("returns null for an unmapped type", () => {
  expect(resolveWorkerNotificationTarget({ type: "milestone_submitted" })).toBeNull();
});

it.each(["job_assigned", "bid_accepted", "bid_rejected"])("maps %s with a jobId to JobDetail", (type) => {
  expect(resolveWorkerNotificationTarget({ type, jobId: "job1" })).toEqual({
    tab: "Jobs",
    screen: "JobDetail",
    params: { jobId: "job1" },
  });
});

it.each(["job_assigned", "bid_accepted", "bid_rejected"])("returns null for %s without a jobId", (type) => {
  expect(resolveWorkerNotificationTarget({ type })).toBeNull();
});

it.each([
  "dispute_opened",
  "dispute_opened_confirmation",
  "dispute_evidence_submitted",
  "dispute_under_review",
  "dispute_resolved",
])("maps %s with a disputeId to DisputeDetail", (type) => {
  expect(resolveWorkerNotificationTarget({ type, disputeId: "d1" })).toEqual({
    tab: "More",
    screen: "DisputeDetail",
    params: { disputeId: "d1" },
  });
});

it("returns null for a dispute type without a disputeId", () => {
  expect(resolveWorkerNotificationTarget({ type: "dispute_opened" })).toBeNull();
});

it("maps payment_released to Payments with no params needed", () => {
  expect(resolveWorkerNotificationTarget({ type: "payment_released" })).toEqual({
    tab: "More",
    screen: "Payments",
  });
});
