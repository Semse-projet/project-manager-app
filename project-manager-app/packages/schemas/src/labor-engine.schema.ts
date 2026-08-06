import { z } from "zod";
import type { JobRecordView } from "./job.schema.js";

// Mirrors apps/api/src/modules/labor-engine/labor-engine.repository.ts's
// TimeEntryRecord/FreeProjectRecord literal unions — the repository types
// themselves widen these to `string` at the DB layer, but every write path
// in labor-engine.service.ts only ever produces these values.
export const timerPurposeSchema = z.enum(["personal", "payable", "job_linked"]);
export const checkInMethodSchema = z.enum(["proximity_confirmed", "proximity_auto"]);
export const timeEntryStatusSchema = z.enum(["running", "paused", "completed"]);
export const freeProjectStatusSchema = z.enum(["active", "archived", "converted"]);

export type TimerPurpose = z.infer<typeof timerPurposeSchema>;
export type CheckInMethod = z.infer<typeof checkInMethodSchema>;
export type TimeEntryStatus = z.infer<typeof timeEntryStatusSchema>;
export type FreeProjectStatus = z.infer<typeof freeProjectStatusSchema>;

export const startTimerSchema = z.object({
  purpose: timerPurposeSchema,
  jobId: z.string().min(1).optional(),
  freeProjectId: z.string().min(1).optional(),
  notes: z.string().trim().max(500).optional(),
  /** Worker's position at start — never blocks the timer, only recorded for auditing. */
  checkIn: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
      method: checkInMethodSchema.optional(),
    })
    .optional(),
  clientEventId: z.string().min(1).optional(),
});

export const freeProjectInputSchema = z.object({
  name: z.string().trim().min(1),
  color: z.string().min(1).optional(),
  location: z.string().min(1).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  description: z.string().trim().max(2000).optional(),
});

export const freeProjectUpdateSchema = freeProjectInputSchema.partial();

export type StartTimerInput = z.infer<typeof startTimerSchema>;
export type FreeProjectInput = z.infer<typeof freeProjectInputSchema>;
export type FreeProjectUpdateInput = z.infer<typeof freeProjectUpdateSchema>;

// Client-facing response shapes (Dates serialize to ISO strings over JSON).
// GET /v1/labor/timer/active, POST /v1/labor/timer/start|:id/stop return
// this shape directly — labor-engine.controller.ts has no separate view
// mapper, unlike field-ops' TrackerSessionView.
export type TimeEntryView = {
  id: string;
  tenantId: string;
  orgId: string;
  createdBy: string;
  mode: string;
  purpose: TimerPurpose;
  jobId: string | null;
  freeProjectId: string | null;
  status: TimeEntryStatus;
  startedAt: string;
  endedAt: string | null;
  resumedAt: string | null;
  pausedAt: string | null;
  breakMinutes: number;
  durationMinutes: number | null;
  accumulatedSeconds: number;
  hourlyRate: number | null;
  currency: string;
  location: string | null;
  checkInLatitude: number | null;
  checkInLongitude: number | null;
  checkInDistanceMeters: number | null;
  checkInMethod: CheckInMethod | null;
  notes: string | null;
  editedBy: string | null;
  editReason: string | null;
  contextEntityType: string | null;
  contextEntityId: string | null;
  clientEventId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ActiveTimerView = TimeEntryView | null;

// GET/POST/PATCH /v1/labor/free-projects — same "no separate view mapper"
// situation as TimeEntryView above.
export type FreeProjectView = {
  id: string;
  tenantId: string;
  createdBy: string;
  name: string;
  color: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  locationSource: string | null;
  description: string | null;
  status: FreeProjectStatus;
  convertedJobId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProximityConfigView = {
  radiusMeters: number;
  cooldownMinutes: number;
};

/** Minimal shape used by the proximity site cache (apps/mobile/src/geo/siteCache.ts) — a Job is a candidate proximity site only when it carries coordinates. */
export type JobSiteView = Pick<JobRecordView, "id" | "title" | "latitude" | "longitude">;

/** Minimal shape used by the proximity site cache for FreeProjects. */
export type FreeProjectSiteView = Pick<FreeProjectView, "id" | "name" | "latitude" | "longitude">;
