/**
 * Maps a remote push notification's `data` payload (set server-side in
 * apps/api/src/modules/notifications/notifications.service.ts's
 * NotificationSpec — `{type, ...payload}`) to the Worker-tab screen it
 * should open. Distinguishes itself from local proximity notifications
 * (../notifications.ts's ProximityNotificationData), which use a `kind`
 * field instead of `type` and are handled by ./proximityResponseHandler.ts.
 *
 * Only covers notification types whose recipient is always the worker/pro
 * side of the event (proUserId in the backend spec) or where both sides can
 * receive it but a Worker-tab screen exists to show it (disputes). Unknown
 * or unmapped types resolve to null — the OS notification still shows,
 * tapping it just doesn't deep-link anywhere.
 */
export type WorkerNotificationTarget =
  | { tab: "Jobs"; screen: "JobDetail"; params: { jobId: string } }
  | { tab: "More"; screen: "DisputeDetail"; params: { disputeId: string } }
  | { tab: "More"; screen: "Payments" };

const JOB_DETAIL_TYPES = new Set(["job_assigned", "bid_accepted", "bid_rejected"]);
const DISPUTE_DETAIL_TYPES = new Set([
  "dispute_opened",
  "dispute_opened_confirmation",
  "dispute_evidence_submitted",
  "dispute_under_review",
  "dispute_resolved",
]);

export function resolveWorkerNotificationTarget(
  data: Record<string, unknown> | null | undefined,
): WorkerNotificationTarget | null {
  const type = data?.type;
  if (typeof type !== "string") return null;

  if (JOB_DETAIL_TYPES.has(type)) {
    const jobId = data?.jobId;
    return typeof jobId === "string" ? { tab: "Jobs", screen: "JobDetail", params: { jobId } } : null;
  }

  if (DISPUTE_DETAIL_TYPES.has(type)) {
    const disputeId = data?.disputeId;
    return typeof disputeId === "string" ? { tab: "More", screen: "DisputeDetail", params: { disputeId } } : null;
  }

  if (type === "payment_released") {
    return { tab: "More", screen: "Payments" };
  }

  return null;
}
