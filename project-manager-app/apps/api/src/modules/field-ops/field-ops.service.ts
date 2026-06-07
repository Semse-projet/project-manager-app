import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import { FieldOpsRepository } from "./field-ops.repository.js";
import type { TrackerSessionView, TrackerSnapshotView } from "@semse/schemas";
import {
  computeTrackerElapsedSeconds,
  mergeTrackerNotes,
  toTrackerSessionView,
  trimTrackerNotes
} from "./tracker-session.js";

@Injectable()
export class FieldOpsService {
  private readonly repo: FieldOpsRepository;
  private readonly auditService: AuditService;

  constructor(repo: FieldOpsRepository, auditService: AuditService) {
    this.repo = repo;
    this.auditService = auditService;
  }

  // ── Units ─────────────────────────────────────────────────────────────────

  listUnits(input: { tenantId: string; projectId?: string; status?: string }) {
    return this.repo.listUnits(input);
  }

  findUnit(input: { tenantId: string; fieldUnitId: string }) {
    return this.repo.findUnitById(input);
  }

  createUnit(input: {
    tenantId: string;
    projectId: string;
    code: string;
    name?: string;
    address?: string;
  }) {
    if (!input.code.trim()) {
      throw new BadRequestException("code is required");
    }
    return this.repo.createUnit(input);
  }

  updateUnitStatus(input: { tenantId: string; fieldUnitId: string; status: string }) {
    const VALID_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETE", "ON_HOLD", "CANCELLED"];
    if (!VALID_STATUSES.includes(input.status)) {
      throw new BadRequestException(`status must be one of: ${VALID_STATUSES.join(", ")}`);
    }
    return this.repo.updateUnitStatus(input);
  }

  // ── Worklogs ─────────────────────────────────────────────────────────────

  listWorklogs(input: { tenantId: string; fieldUnitId?: string; dateFrom?: string; dateTo?: string }) {
    return this.repo.listWorklogs({
      tenantId: input.tenantId,
      fieldUnitId: input.fieldUnitId,
      dateFrom: input.dateFrom ? new Date(input.dateFrom) : undefined,
      dateTo:   input.dateTo   ? new Date(input.dateTo)   : undefined,
    });
  }

  createWorklog(input: {
    tenantId: string;
    fieldUnitId: string;
    date: string;
    doneToday: string;
    pendingNext: string;
    blockers?: string;
    notes?: string;
    createdBy: string;
  }) {
    if (!input.doneToday.trim()) throw new BadRequestException("doneToday is required");
    if (!input.pendingNext.trim()) throw new BadRequestException("pendingNext is required");

    return this.repo.createWorklog({
      ...input,
      date: new Date(input.date),
    });
  }

  // ── Tracker Sessions ─────────────────────────────────────────────────────

  async getTrackerSnapshot(input: {
    tenantId: string;
    createdBy: string;
  }): Promise<TrackerSnapshotView> {
    const [activeSession, recentSessions] = await Promise.all([
      this.repo.findActiveTrackerSession({
        tenantId: input.tenantId,
        createdBy: input.createdBy,
      }),
      this.repo.listRecentTrackerSessions({
        tenantId: input.tenantId,
        createdBy: input.createdBy,
        limit: 20,
      }),
    ]);

    return {
      activeSession: activeSession ? toTrackerSessionView(activeSession) : null,
      recentSessions: recentSessions.map(toTrackerSessionView),
    };
  }

  async startTrackerSession(input: {
    tenantId: string;
    orgId: string;
    createdBy: string;
    requestId: string;
    jobId: string;
    notes?: string;
  }): Promise<TrackerSessionView> {
    const [job, activeSession] = await Promise.all([
      this.repo.findJobForTracker({ tenantId: input.tenantId, jobId: input.jobId }),
      this.repo.findActiveTrackerSession({ tenantId: input.tenantId, createdBy: input.createdBy }),
    ]);

    if (!job) {
      throw new BadRequestException("jobId is invalid for the tracker");
    }

    if (activeSession) {
      if (activeSession.status === "RUNNING" && activeSession.jobId === input.jobId) {
        return toTrackerSessionView(activeSession);
      }

      throw new ConflictException("Ya existe una sesión activa o en pausa para este usuario.");
    }

    const now = new Date();
    const created = await this.repo.createTrackerSession({
      tenantId: input.tenantId,
      orgId: input.orgId,
      jobId: input.jobId,
      createdBy: input.createdBy,
      startedAt: now,
      resumedAt: now,
      accumulatedSeconds: 0,
      notes: trimTrackerNotes(input.notes),
      status: "RUNNING",
    });

    await this.auditService.append({
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.createdBy,
      action: "tracker.session.started",
      entityType: "TrackerSession",
      entityId: created.id,
      requestId: input.requestId,
      timestamp: now.toISOString(),
      afterJson: {
        jobId: input.jobId,
        status: created.status,
        notes: created.notes,
      },
    });

    return toTrackerSessionView(created);
  }

  async pauseTrackerSession(input: {
    tenantId: string;
    orgId: string;
    createdBy: string;
    requestId: string;
    sessionId: string;
    notes?: string;
  }): Promise<TrackerSessionView> {
    const current = await this.repo.findTrackerSessionById({
      tenantId: input.tenantId,
      createdBy: input.createdBy,
      sessionId: input.sessionId,
    });

    if (current.status !== "RUNNING") {
      throw new ConflictException("Solo se puede pausar una sesión en ejecución.");
    }

    const now = new Date();
    const updated = await this.repo.updateTrackerSession({
      sessionId: current.id,
      status: "PAUSED",
      resumedAt: null,
      pausedAt: now,
      accumulatedSeconds: computeTrackerElapsedSeconds(current, now),
      notes: mergeTrackerNotes(current.notes, input.notes),
    });

    await this.auditService.append({
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.createdBy,
      action: "tracker.session.paused",
      entityType: "TrackerSession",
      entityId: updated.id,
      requestId: input.requestId,
      timestamp: now.toISOString(),
      beforeJson: { status: current.status, accumulatedSeconds: current.accumulatedSeconds },
      afterJson: { status: updated.status, accumulatedSeconds: updated.accumulatedSeconds },
    });

    return toTrackerSessionView(updated);
  }

  async resumeTrackerSession(input: {
    tenantId: string;
    orgId: string;
    createdBy: string;
    requestId: string;
    sessionId: string;
    notes?: string;
  }): Promise<TrackerSessionView> {
    const current = await this.repo.findTrackerSessionById({
      tenantId: input.tenantId,
      createdBy: input.createdBy,
      sessionId: input.sessionId,
    });

    if (current.status !== "PAUSED") {
      throw new ConflictException("Solo se puede reanudar una sesión en pausa.");
    }

    const now = new Date();
    const updated = await this.repo.updateTrackerSession({
      sessionId: current.id,
      status: "RUNNING",
      resumedAt: now,
      pausedAt: null,
      notes: mergeTrackerNotes(current.notes, input.notes),
    });

    await this.auditService.append({
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.createdBy,
      action: "tracker.session.resumed",
      entityType: "TrackerSession",
      entityId: updated.id,
      requestId: input.requestId,
      timestamp: now.toISOString(),
      beforeJson: { status: current.status, accumulatedSeconds: current.accumulatedSeconds },
      afterJson: { status: updated.status, accumulatedSeconds: updated.accumulatedSeconds },
    });

    return toTrackerSessionView(updated);
  }

  async stopTrackerSession(input: {
    tenantId: string;
    orgId: string;
    createdBy: string;
    requestId: string;
    sessionId: string;
    notes?: string;
  }): Promise<TrackerSessionView> {
    const current = await this.repo.findTrackerSessionById({
      tenantId: input.tenantId,
      createdBy: input.createdBy,
      sessionId: input.sessionId,
    });

    if (current.status === "STOPPED") {
      return toTrackerSessionView(current);
    }

    const now = new Date();
    const updated = await this.repo.updateTrackerSession({
      sessionId: current.id,
      status: "STOPPED",
      resumedAt: null,
      pausedAt: current.status === "PAUSED" ? current.pausedAt : now,
      stoppedAt: now,
      accumulatedSeconds: computeTrackerElapsedSeconds(current, now),
      notes: mergeTrackerNotes(current.notes, input.notes),
    });

    await this.auditService.append({
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.createdBy,
      action: "tracker.session.stopped",
      entityType: "TrackerSession",
      entityId: updated.id,
      requestId: input.requestId,
      timestamp: now.toISOString(),
      beforeJson: { status: current.status, accumulatedSeconds: current.accumulatedSeconds },
      afterJson: { status: updated.status, accumulatedSeconds: updated.accumulatedSeconds },
    });

    return toTrackerSessionView(updated);
  }

  async createManualTrackerSession(input: {
    tenantId: string;
    orgId: string;
    createdBy: string;
    requestId: string;
    jobId: string;
    date: string;
    startTime: string;
    endTime: string;
    notes?: string;
  }): Promise<TrackerSessionView> {
    const job = await this.repo.findJobForTracker({ tenantId: input.tenantId, jobId: input.jobId });
    if (!job) {
      throw new BadRequestException("jobId is invalid for the tracker");
    }

    const startedAt = new Date(`${input.date}T${input.startTime}:00.000Z`);
    const stoppedAt = new Date(`${input.date}T${input.endTime}:00.000Z`);
    if (Number.isNaN(startedAt.getTime()) || Number.isNaN(stoppedAt.getTime()) || stoppedAt <= startedAt) {
      throw new BadRequestException("La entrada manual debe tener un rango de tiempo válido.");
    }

    const created = await this.repo.createTrackerSession({
      tenantId: input.tenantId,
      orgId: input.orgId,
      jobId: input.jobId,
      createdBy: input.createdBy,
      startedAt,
      resumedAt: null,
      pausedAt: stoppedAt,
      stoppedAt,
      accumulatedSeconds: Math.floor((stoppedAt.getTime() - startedAt.getTime()) / 1000),
      notes: trimTrackerNotes(input.notes),
      status: "STOPPED",
    });

    await this.auditService.append({
      tenantId: input.tenantId,
      orgId: input.orgId,
      actorUserId: input.createdBy,
      action: "tracker.session.manual_created",
      entityType: "TrackerSession",
      entityId: created.id,
      requestId: input.requestId,
      timestamp: new Date().toISOString(),
      afterJson: {
        jobId: created.jobId,
        accumulatedSeconds: created.accumulatedSeconds,
        startedAt: created.startedAt.toISOString(),
        stoppedAt: created.stoppedAt?.toISOString() ?? null,
      },
    });

    return toTrackerSessionView(created);
  }

  // ── Knowledge Facts ──────────────────────────────────────────────────────

  listFacts(input: { tenantId: string; subject?: string; predicate?: string }) {
    return this.repo.listFacts(input);
  }

  createFact(input: {
    tenantId: string;
    subject: string;
    predicate: string;
    object: string;
    confidence?: number;
    worklogId?: string;
    createdBy: string;
  }) {
    if (!input.subject.trim())   throw new BadRequestException("subject is required");
    if (!input.predicate.trim()) throw new BadRequestException("predicate is required");
    if (!input.object.trim())    throw new BadRequestException("object is required");
    return this.repo.createFact(input);
  }

  // ── Vendors ───────────────────────────────────────────────────────────────

  listVendors(input: { tenantId: string }) {
    return this.repo.listVendors(input);
  }

  createVendor(input: {
    tenantId: string;
    name: string;
    phone?: string;
    email?: string;
    notes?: string;
  }) {
    if (!input.name.trim()) throw new BadRequestException("name is required");
    return this.repo.createVendor(input);
  }

  upsertComplianceDoc(input: {
    tenantId: string;
    vendorId: string;
    type: string;
    status: string;
    fileUrl?: string;
    expiresAt?: string;
    notes?: string;
  }) {
    const VALID_STATUSES = ["MISSING", "PENDING", "APPROVED", "EXPIRED"];
    if (!VALID_STATUSES.includes(input.status)) {
      throw new BadRequestException(`status must be one of: ${VALID_STATUSES.join(", ")}`);
    }
    return this.repo.upsertComplianceDoc({
      ...input,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
    });
  }
}
