import { randomBytes } from "node:crypto";
import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { hasPermission } from "../../common/rbac.js";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { hashSummary, hashToken, normalizeTrade, summarizeExperience, type SkillSummary } from "./skills.calc.js";

/**
 * BO-12 — experiencia confirmada y atestaciones portables.
 * Spec: docs/specs/core/skills.spec.md
 *
 * OPEN-12: una tarea suma al terminarse Y revisarse por un responsable; sin revisión no cuenta.
 * OPEN-13: solo un resumen redactado, con el consentimiento de la persona, que ella puede revocar.
 * Sin niveles, sin insignias, sin licencias.
 */
const CREWS_MANAGE = "org:crews:manage";
const REDEEM = "org:offers:manage";
const DEFAULT_EXPIRY_DAYS = 30;

export type SkillsActor = { tenantId: string; orgId: string; userId: string; roles: string[] };

export function isSkillsEnabled(): boolean {
  return process.env.SEMSE_SKILLS_ENABLED === "true";
}

@Injectable()
export class SkillsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  private assertEnabled(): void {
    if (!isSkillsEnabled()) {
      throw new NotFoundException();
    }
  }

  private async liveRoles(userId: string, tenantId: string, orgId: string): Promise<string[]> {
    const live = await this.prisma.membership.findMany({
      where: { userId, orgId, status: "ACTIVE", org: { tenantId } },
      include: { role: true }
    });
    if (live.length === 0) throw new NotFoundException();
    return live.map((m) => m.role.key);
  }

  private async record(
    tenantId: string,
    orgId: string,
    actorUserId: string,
    action: string,
    entityType: string,
    entityId: string,
    requestId: string,
    afterJson: Record<string, unknown>
  ): Promise<void> {
    await this.audit.append({
      tenantId,
      orgId,
      actorUserId,
      action,
      entityType,
      entityId,
      requestId,
      timestamp: new Date().toISOString(),
      afterJson
    });
  }

  /** El responsable decide sobre una asignación ENVIADA de su cuadrilla; la experiencia cuenta solo si la confirma. */
  async reviewAllocation(
    actor: SkillsActor,
    allocationId: string,
    requestId: string,
    input: { decision: "CONFIRM" | "REJECT"; trade?: string; note?: string }
  ) {
    this.assertEnabled();
    const allocation = await this.prisma.taskAllocation.findFirst({ where: { id: allocationId, tenantId: actor.tenantId } });
    if (!allocation) throw new NotFoundException();
    const crew = await this.prisma.crew.findFirst({ where: { id: allocation.crewId, tenantId: actor.tenantId } });
    if (!crew) throw new NotFoundException();
    const roles = await this.liveRoles(actor.userId, actor.tenantId, allocation.orgId);
    if (crew.supervisorUserId !== actor.userId && !hasPermission(roles, CREWS_MANAGE)) throw new ForbiddenException();
    if (allocation.userId === actor.userId) throw new ForbiddenException("No se puede revisar el propio trabajo");
    if (allocation.status !== "SUBMITTED") {
      throw new UnprocessableEntityException("Solo se revisan asignaciones enviadas como terminadas");
    }
    const trade = input.trade ? normalizeTrade(input.trade) : "";
    if (input.decision === "CONFIRM" && trade.length < 2) {
      throw new UnprocessableEntityException("Indica el oficio de la experiencia");
    }
    const existing = await this.prisma.skillExperience.findFirst({ where: { sourceType: "TASK_ALLOCATION", sourceId: allocation.id } });
    if (existing) throw new ConflictException("Esta asignación ya fue revisada");
    const status = input.decision === "CONFIRM" ? "CONFIRMED" : "REJECTED";
    let row: { id: string };
    try {
      row = await this.prisma.skillExperience.create({
        data: {
          tenantId: actor.tenantId,
          orgId: allocation.orgId,
          userId: allocation.userId,
          trade: trade || "sin-oficio",
          sourceType: "TASK_ALLOCATION",
          sourceId: allocation.id,
          status,
          reviewedByUserId: actor.userId,
          reviewNote: input.note ?? null,
          decidedAt: new Date()
        }
      });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") throw new ConflictException("Esta asignación ya fue revisada");
      throw error;
    }
    await this.record(
      actor.tenantId,
      allocation.orgId,
      actor.userId,
      status === "CONFIRMED" ? "skill_experience.confirmed" : "skill_experience.rejected",
      "SkillExperience",
      row.id,
      requestId,
      { allocationId: allocation.id }
    );
    return { status };
  }

  /** La persona ve sus propios hechos: conteo y meses por oficio (solo lo CONFIRMADO). */
  async mySkills(user: { userId: string }) {
    this.assertEnabled();
    const rows = await this.prisma.skillExperience.findMany({ where: { userId: user.userId, status: "CONFIRMED" } });
    return summarizeExperience(rows.map((r) => ({ trade: r.trade, decidedAt: r.decidedAt })), new Date());
  }

  async createAttestation(
    actor: SkillsActor,
    requestId: string,
    input: { consent: true; trades?: string[]; expiresInDays?: number }
  ) {
    this.assertEnabled();
    const rows = await this.prisma.skillExperience.findMany({ where: { userId: actor.userId, status: "CONFIRMED" } });
    const summary = summarizeExperience(rows.map((r) => ({ trade: r.trade, decidedAt: r.decidedAt })), new Date(), input.trades);
    if (summary.trades.length === 0) {
      throw new UnprocessableEntityException("No hay experiencia confirmada para compartir");
    }
    const token = randomBytes(24).toString("base64url");
    const now = new Date();
    const created = await this.prisma.skillAttestation.create({
      data: {
        userId: actor.userId,
        summary,
        contentHash: hashSummary(summary),
        tokenHash: hashToken(token),
        consentedAt: now,
        expiresAt: new Date(now.getTime() + (input.expiresInDays ?? DEFAULT_EXPIRY_DAYS) * 24 * 60 * 60 * 1000)
      }
    });
    await this.record(actor.tenantId, actor.orgId, actor.userId, "skill_attestation.created", "SkillAttestation", created.id, requestId, {
      trades: summary.trades.map((t) => t.trade)
    });
    // El token se devuelve UNA vez; solo se guarda su hash.
    return { attestationId: created.id, token, expiresAt: created.expiresAt, summary };
  }

  async listAttestations(user: { userId: string }) {
    this.assertEnabled();
    const rows = await this.prisma.skillAttestation.findMany({ where: { userId: user.userId } });
    return rows.map((row) => ({
      attestationId: row.id,
      status: row.status,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
      contentHash: row.contentHash,
      createdAt: row.createdAt
    }));
  }

  async revokeAttestation(actor: SkillsActor, attestationId: string, requestId: string) {
    this.assertEnabled();
    const row = await this.prisma.skillAttestation.findFirst({ where: { id: attestationId, userId: actor.userId } });
    if (!row) throw new NotFoundException();
    const claimed = await this.prisma.skillAttestation.updateMany({
      where: { id: row.id, status: "ACTIVE" },
      data: { status: "REVOKED", revokedAt: new Date() }
    });
    if (claimed.count !== 1) throw new ConflictException("La atestación ya estaba revocada");
    await this.record(actor.tenantId, actor.orgId, actor.userId, "skill_attestation.revoked", "SkillAttestation", row.id, requestId, {});
    return { status: "REVOKED" as const };
  }

  /** Un gestor de otra empresa canjea el token que la persona le entregó. 404 neutro si no sirve. */
  async redeem(actor: SkillsActor, orgId: string, token: string, requestId: string): Promise<SkillSummary> {
    this.assertEnabled();
    const roles = await this.liveRoles(actor.userId, actor.tenantId, orgId);
    if (!hasPermission(roles, REDEEM)) throw new ForbiddenException();
    const row = await this.prisma.skillAttestation.findFirst({ where: { tokenHash: hashToken(token) } });
    if (!row || row.status !== "ACTIVE" || row.expiresAt.getTime() <= Date.now()) {
      throw new NotFoundException();
    }
    await this.record(actor.tenantId, orgId, actor.userId, "skill_attestation.redeemed", "SkillAttestation", row.id, requestId, {});
    return row.summary as SkillSummary;
  }
}
