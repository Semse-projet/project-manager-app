import crypto from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  canTransitionLiveSession,
  liveSessionAddParticipantSchema,
  liveSessionCreateSchema,
  liveSessionEventSchema,
  liveSessionTransitionSchema,
  liveSessionTransitionTarget,
  isLiveSessionTerminal,
  LIVE_SESSION_MEDIA_STATUSES,
  type LiveSessionParticipantRole,
  type LiveSessionRecordView,
  type LiveSessionStatus,
  type LiveSessionTransitionAction,
} from "@semse/schemas";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import { SseEventBusService } from "../../infrastructure/sse/sse-event-bus.service.js";
import {
  LIVE_SESSIONS_REPOSITORY,
  type LiveSessionRow,
  type LiveSessionsRepository,
} from "./live-sessions.repository.js";
import {
  LIVE_SESSIONS_RESOURCE_ACCESS,
  type LiveSessionResourceAccess,
} from "./live-sessions.resource-access.js";

export type LiveSessionActor = {
  userId: string;
  tenantId: string;
  orgId: string;
  roles: string[];
};

/** TTL por defecto de una sesión sin cerrar (spec §13.4). 2 h. */
export const LIVE_SESSION_DEFAULT_TTL_MS = 2 * 60 * 60 * 1000;

@Injectable()
export class LiveSessionsService {
  private readonly logger = new Logger(LiveSessionsService.name);

  constructor(
    @Inject(LIVE_SESSIONS_REPOSITORY) private readonly repo: LiveSessionsRepository,
    @Inject(LIVE_SESSIONS_RESOURCE_ACCESS) private readonly resourceAccess: LiveSessionResourceAccess,
    private readonly audit: AuditService,
    private readonly sse: SseEventBusService,
  ) {}

  // ── helpers ──────────────────────────────────────────────────────────────

  private view(row: LiveSessionRow): LiveSessionRecordView {
    return {
      id: row.id,
      tenantId: row.tenantId,
      scopeType: row.scopeType,
      scopeId: row.scopeId,
      purpose: row.purpose,
      status: row.status,
      version: row.version,
      createdById: row.createdById,
      expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
      endedAt: row.endedAt ? row.endedAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private channel(row: Pick<LiveSessionRow, "tenantId" | "id">): string {
    return `live-session:${row.tenantId}:${row.id}`;
  }

  /** Sesión visible sólo para participantes activos del mismo tenant; si no, 404. */
  private async loadForParticipant(actor: LiveSessionActor, sessionId: string): Promise<LiveSessionRow> {
    const row = await this.repo.findById(actor.tenantId, sessionId);
    if (row) {
      const p = await this.repo.findParticipant(sessionId, actor.userId);
      if (p && p.leftAt === null) return row;
    }
    throw new NotFoundException("live session not found");
  }

  private auditView(row: LiveSessionRow): Record<string, unknown> {
    return {
      scopeType: row.scopeType,
      scopeId: row.scopeId,
      purpose: row.purpose,
      status: row.status,
      version: row.version,
    };
  }

  private emit(
    eventType: "live_session.requested.v1" | "live_session.status_changed.v1",
    row: LiveSessionRow,
    actorId: string,
    correlationId: string,
    previousStatus?: LiveSessionStatus,
  ): void {
    try {
      const event = liveSessionEventSchema.parse({
        eventId: crypto.randomUUID(),
        eventType,
        version: 1,
        tenantId: row.tenantId,
        aggregateType: "LiveSession",
        aggregateId: row.id,
        actorType: "user",
        actorId,
        correlationId,
        occurredAt: new Date().toISOString(),
        payload: {
          sessionId: row.id,
          scopeType: row.scopeType,
          scopeId: row.scopeId,
          previousStatus,
          status: row.status,
          sessionVersion: row.version,
        },
      });
      this.sse.emit(this.channel(row), eventType, event);
    } catch (err) {
      // best-effort: el SSE entrega snapshot al reconectar (plan §6)
      this.logger.warn(`live_session event emit failed: ${(err as Error).message}`);
    }
  }

  // ── comandos ─────────────────────────────────────────────────────────────

  async create(
    actor: LiveSessionActor,
    requestId: string,
    body: unknown,
  ): Promise<LiveSessionRecordView> {
    const parsed = liveSessionCreateSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input = parsed.data;

    const existing = await this.repo.findByIdempotency(actor.tenantId, input.idempotencyKey);
    if (existing) {
      if (
        existing.scopeType !== input.scopeType ||
        existing.scopeId !== input.scopeId ||
        existing.purpose !== input.purpose ||
        existing.createdById !== actor.userId
      ) {
        throw new ConflictException("idempotency key is bound to another LiveSession command");
      }
      return this.view(existing);
    }

    const allowed = await this.resourceAccess.canOpenSession(actor, input.scopeType, input.scopeId);
    if (!allowed) throw new NotFoundException("live session not found");

    const row = await this.repo.create({
      tenantId: actor.tenantId,
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      purpose: input.purpose,
      createdById: actor.userId,
      idempotencyKey: input.idempotencyKey,
      expiresAt: new Date(Date.now() + LIVE_SESSION_DEFAULT_TTL_MS),
      ownerUserId: actor.userId,
    });

    await this.audit.append({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      actorUserId: actor.userId,
      action: "live_session.requested",
      entityType: "LiveSession",
      entityId: row.id,
      requestId,
      timestamp: new Date().toISOString(),
      afterJson: this.auditView(row),
    });
    this.emit("live_session.requested.v1", row, actor.userId, requestId);
    return this.view(row);
  }

  async get(actor: LiveSessionActor, sessionId: string): Promise<LiveSessionRecordView> {
    return this.view(await this.loadForParticipant(actor, sessionId));
  }

  async listParticipants(actor: LiveSessionActor, sessionId: string) {
    await this.loadForParticipant(actor, sessionId);
    const rows = await this.repo.listParticipants(sessionId);
    return rows.map((p) => ({
      id: p.id,
      sessionId: p.sessionId,
      userId: p.userId,
      role: p.role,
      joinedAt: p.joinedAt ? p.joinedAt.toISOString() : null,
      leftAt: p.leftAt ? p.leftAt.toISOString() : null,
    }));
  }

  async transition(
    actor: LiveSessionActor,
    requestId: string,
    sessionId: string,
    body: unknown,
  ): Promise<LiveSessionRecordView> {
    const parsed = liveSessionTransitionSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const { action, expectedVersion, reason } = parsed.data;

    const current = await this.loadForParticipant(actor, sessionId);
    if (current.version !== expectedVersion) {
      throw new ConflictException("LiveSession version conflict");
    }
    await this.assertActionAllowed(current, actor, action);

    const to = liveSessionTransitionTarget(current.status, action);
    if (!to || !canTransitionLiveSession(current.status, to)) {
      throw new ConflictException(`Cannot ${action} LiveSession from ${current.status}`);
    }

    const updated = await this.repo.transition({
      tenantId: actor.tenantId,
      sessionId,
      expectedVersion,
      toStatus: to,
      endedAt: isLiveSessionTerminal(to) ? new Date() : null,
    });
    if (!updated) throw new ConflictException("LiveSession version conflict");

    await this.audit.append({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      actorUserId: actor.userId,
      action: `live_session.${action}`,
      entityType: "LiveSession",
      entityId: updated.id,
      requestId,
      timestamp: new Date().toISOString(),
      beforeJson: this.auditView(current),
      afterJson: { ...this.auditView(updated), reason },
    });
    this.emit("live_session.status_changed.v1", updated, actor.userId, requestId, current.status);
    return this.view(updated);
  }

  /** `accept` sólo por un participante que NO es el creador (spec §6). */
  private async assertActionAllowed(
    current: LiveSessionRow,
    actor: LiveSessionActor,
    action: LiveSessionTransitionAction,
  ): Promise<void> {
    if (action === "accept" && current.createdById === actor.userId) {
      throw new ConflictException("the session creator cannot accept their own session");
    }
    if (action === "cancel") {
      const p = await this.repo.findParticipant(current.id, actor.userId);
      if (!p || p.role !== "owner") {
        throw new ConflictException("only the session owner can cancel");
      }
    }
  }

  async addParticipant(
    actor: LiveSessionActor,
    requestId: string,
    sessionId: string,
    body: unknown,
  ) {
    const parsed = liveSessionAddParticipantSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const { userId, role, expectedVersion } = parsed.data;

    const current = await this.loadForParticipant(actor, sessionId);
    if (current.version !== expectedVersion) throw new ConflictException("LiveSession version conflict");

    const me = await this.repo.findParticipant(sessionId, actor.userId);
    if (!me || me.role !== "owner") throw new ConflictException("only the session owner can add participants");
    if (isLiveSessionTerminal(current.status)) throw new ConflictException("session is terminal");
    if (role !== "observer" && current.status !== "REQUESTED" && current.status !== "PERMISSION_PENDING") {
      throw new ConflictException("inspector/assistant can only be added before the session connects");
    }

    const canAccess = await this.resourceAccess.canOpenSession(
      { userId, tenantId: actor.tenantId, orgId: actor.orgId, roles: [] },
      current.scopeType,
      current.scopeId,
    );
    if (!canAccess) throw new BadRequestException("target user has no access to the session's resource");

    const existing = await this.repo.findParticipant(sessionId, userId);
    if (existing) return { ...existing, joinedAt: existing.joinedAt?.toISOString() ?? null, leftAt: existing.leftAt?.toISOString() ?? null };

    const added = await this.repo.addParticipant({
      tenantId: actor.tenantId,
      sessionId,
      userId,
      role: role as LiveSessionParticipantRole,
      invitedById: actor.userId,
    });
    await this.audit.append({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      actorUserId: actor.userId,
      action: "live_session.participant_added",
      entityType: "LiveSession",
      entityId: sessionId,
      requestId,
      timestamp: new Date().toISOString(),
      afterJson: { addedUserId: userId, role },
    });
    return { ...added, joinedAt: null, leftAt: null };
  }

  /**
   * Driver `PERMISSION_PENDING -> CONNECTING` (spec §6). v1: lo dispara
   * cualquier participante activo tras conceder permisos; el refinamiento
   * "todos listos" queda como TODO. También lo pueden llamar los webhooks de
   * LiveKit vía `driveFromWebhook`.
   */
  async markReady(
    actor: LiveSessionActor,
    requestId: string,
    sessionId: string,
    expectedVersion: number,
  ): Promise<LiveSessionRecordView> {
    const current = await this.loadForParticipant(actor, sessionId);
    if (current.version !== expectedVersion) throw new ConflictException("LiveSession version conflict");
    if (current.status !== "PERMISSION_PENDING") {
      throw new ConflictException(`participant-ready not valid from ${current.status}`);
    }
    return this.applyTransition(current, "CONNECTING", actor.userId, actor.orgId, requestId, "participant-ready");
  }

  /**
   * Transición disparada por un webhook de LiveKit (spec §6). No pasa por la
   * autorización de participante: la autoridad es la firma del webhook,
   * verificada en el controller antes de llamar aquí.
   */
  async driveFromWebhook(
    tenantId: string,
    sessionId: string,
    toStatus: LiveSessionStatus,
    correlationId: string,
  ): Promise<void> {
    const current = await this.repo.findById(tenantId, sessionId);
    if (!current) return;
    if (!canTransitionLiveSession(current.status, toStatus)) {
      this.logger.warn(
        `webhook wants ${current.status} -> ${toStatus} for ${sessionId}, not a valid edge; ignoring`,
      );
      return;
    }
    await this.applyTransition(current, toStatus, "platform", "", correlationId, `webhook:${toStatus}`, "platform");
  }

  private async applyTransition(
    current: LiveSessionRow,
    to: LiveSessionStatus,
    actorId: string,
    orgId: string,
    requestId: string,
    reason: string,
    actorType: "user" | "platform" = "user",
  ): Promise<LiveSessionRecordView> {
    const updated = await this.repo.transition({
      tenantId: current.tenantId,
      sessionId: current.id,
      expectedVersion: current.version,
      toStatus: to,
      endedAt: isLiveSessionTerminal(to) ? new Date() : null,
    });
    if (!updated) throw new ConflictException("LiveSession version conflict");
    await this.audit.append({
      tenantId: current.tenantId,
      orgId: orgId || current.tenantId,
      actorUserId: actorId === "platform" ? current.createdById : actorId,
      action: `live_session.${reason.replace(/[^a-z_:.-]/gi, "")}`,
      entityType: "LiveSession",
      entityId: updated.id,
      requestId,
      timestamp: new Date().toISOString(),
      beforeJson: this.auditView(current),
      afterJson: { ...this.auditView(updated), reason },
    });
    this.emitTyped("live_session.status_changed.v1", updated, actorId, requestId, current.status, actorType);
    return this.view(updated);
  }

  private emitTyped(
    eventType: "live_session.requested.v1" | "live_session.status_changed.v1",
    row: LiveSessionRow,
    actorId: string,
    correlationId: string,
    previousStatus: LiveSessionStatus | undefined,
    actorType: "user" | "platform",
  ): void {
    try {
      const event = liveSessionEventSchema.parse({
        eventId: crypto.randomUUID(),
        eventType,
        version: 1,
        tenantId: row.tenantId,
        aggregateType: "LiveSession",
        aggregateId: row.id,
        actorType,
        actorId: actorId === "platform" ? "platform" : actorId,
        correlationId: correlationId || crypto.randomUUID(),
        occurredAt: new Date().toISOString(),
        payload: {
          sessionId: row.id,
          scopeType: row.scopeType,
          scopeId: row.scopeId,
          previousStatus,
          status: row.status,
          sessionVersion: row.version,
        },
      });
      this.sse.emit(this.channel(row), eventType, event);
    } catch (err) {
      this.logger.warn(`live_session event emit failed: ${(err as Error).message}`);
    }
  }

  /** Barrido de sesiones vencidas -> terminal (spec §13.4). Devuelve cuántas cerró. */
  async sweepExpired(now = new Date(), limit = 100): Promise<number> {
    const expired = await this.repo.listExpired(now, limit);
    let closed = 0;
    for (const row of expired) {
      const to: LiveSessionStatus =
        row.status === "CONNECTING" || row.status === "ENDING" ? "FAILED" : "CANCELLED";
      if (!canTransitionLiveSession(row.status, to)) continue;
      const updated = await this.repo.transition({
        tenantId: row.tenantId,
        sessionId: row.id,
        expectedVersion: row.version,
        toStatus: to,
        endedAt: new Date(),
      });
      if (updated) {
        closed++;
        this.emitTyped("live_session.status_changed.v1", updated, "platform", "", row.status, "platform");
      }
    }
    return closed;
  }

  /** ¿El actor puede pedir un media-token ahora? (spec §5, §13.3) */
  async assertCanIssueMediaToken(actor: LiveSessionActor, sessionId: string): Promise<LiveSessionRow> {
    const row = await this.loadForParticipant(actor, sessionId);
    if (!LIVE_SESSION_MEDIA_STATUSES.includes(row.status)) {
      throw new ConflictException(`media is not available while the session is ${row.status}`);
    }
    if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) {
      throw new ConflictException("session has expired");
    }
    return row;
  }
}
