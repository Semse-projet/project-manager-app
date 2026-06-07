import { z } from "zod";

export const trackerSessionStatusSchema = z.enum(["RUNNING", "PAUSED", "STOPPED"]);

export const startTrackerSessionSchema = z.object({
  jobId: z.string().min(1),
  notes: z.string().trim().max(500).optional(),
});

export const trackerSessionMutationSchema = z.object({
  notes: z.string().trim().max(500).optional(),
});

export const createManualTrackerSessionSchema = z.object({
  jobId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "startTime must be HH:MM"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "endTime must be HH:MM"),
  notes: z.string().trim().max(500).optional(),
});

export type TrackerSessionStatus = z.infer<typeof trackerSessionStatusSchema>;
export type StartTrackerSessionInput = z.infer<typeof startTrackerSessionSchema>;
export type TrackerSessionMutationInput = z.infer<typeof trackerSessionMutationSchema>;
export type CreateManualTrackerSessionInput = z.infer<typeof createManualTrackerSessionSchema>;

export type TrackerSessionView = {
  id: string;
  tenantId: string;
  orgId: string;
  jobId: string;
  createdBy: string;
  status: TrackerSessionStatus;
  startedAt: string;
  resumedAt: string | null;
  pausedAt: string | null;
  stoppedAt: string | null;
  accumulatedSeconds: number;
  elapsedSeconds: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  job: {
    id: string;
    title: string;
    status: string;
  };
};

export type TrackerSnapshotView = {
  activeSession: TrackerSessionView | null;
  recentSessions: TrackerSessionView[];
};
