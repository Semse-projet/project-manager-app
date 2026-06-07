import type { TrackerSessionView } from "@semse/schemas";

export type TrackerSessionRecord = {
  id: string;
  tenantId: string;
  orgId: string;
  jobId: string;
  createdBy: string;
  status: "RUNNING" | "PAUSED" | "STOPPED";
  startedAt: Date;
  resumedAt: Date | null;
  pausedAt: Date | null;
  stoppedAt: Date | null;
  accumulatedSeconds: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  job: {
    id: string;
    title: string;
    status: string;
  };
};

export function computeTrackerElapsedSeconds(
  session: Pick<TrackerSessionRecord, "accumulatedSeconds" | "status" | "resumedAt">,
  now: Date
): number {
  if (session.status !== "RUNNING" || !session.resumedAt) {
    return session.accumulatedSeconds;
  }

  const delta = Math.max(0, Math.floor((now.getTime() - session.resumedAt.getTime()) / 1000));
  return session.accumulatedSeconds + delta;
}

export function toTrackerSessionView(session: TrackerSessionRecord): TrackerSessionView {
  return {
    id: session.id,
    tenantId: session.tenantId,
    orgId: session.orgId,
    jobId: session.jobId,
    createdBy: session.createdBy,
    status: session.status,
    startedAt: session.startedAt.toISOString(),
    resumedAt: session.resumedAt?.toISOString() ?? null,
    pausedAt: session.pausedAt?.toISOString() ?? null,
    stoppedAt: session.stoppedAt?.toISOString() ?? null,
    accumulatedSeconds: session.accumulatedSeconds,
    elapsedSeconds: computeTrackerElapsedSeconds(session, new Date()),
    notes: session.notes ?? null,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    job: {
      id: session.job.id,
      title: session.job.title,
      status: session.job.status,
    },
  };
}

export function trimTrackerNotes(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function mergeTrackerNotes(current?: string | null, next?: string): string | null | undefined {
  const trimmed = next?.trim();
  if (!trimmed) {
    return current ?? undefined;
  }

  return trimmed;
}
