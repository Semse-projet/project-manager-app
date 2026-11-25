import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import type { GeofenceSiteView } from "@semse/schemas";
import { jobAssignmentWhere } from "../../common/job-assignment.js";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import {
  accuracyBucket,
  COOLDOWN_MS,
  decide,
  type GeofenceDecision,
  type GeofenceType,
  type LocationMode
} from "./geofence.policy.js";
import {
  isWorksiteBindingEnabled,
  isWorksiteLocationVerified,
  resolveSiteForWorker,
  type SiteRef
} from "./site-binding.js";

/**
 * BO-09 — preferencia de ubicación y decisión ante eventos de geocerca.
 * Spec: docs/specs/core/geofence-policy.spec.md
 *
 * Decisiones del propietario (2026-10-18): ASK por defecto (OPEN-07/08); AUTO solo con un
 * consentimiento aparte del trabajador, revocable; retención mínima (OPEN-10): NO se guardan
 * coordenadas, solo el resultado y un rango de precisión. El servidor devuelve una decisión:
 * no inicia ni termina relojes ni inventa horas.
 */
export type GeofenceActor = { tenantId: string; orgId: string; userId: string };

/** Máximo de sitios detectables devueltos a una persona (tras filtrar por elegibilidad). */
export const MAX_GEOFENCE_SITES = 200;

export function isGeofencePolicyEnabled(): boolean {
  return process.env.SEMSE_GEOFENCE_POLICY_ENABLED === "true";
}

export type EventInput = {
  eventId: string;
  type: GeofenceType;
  worksiteId?: string;
  /** OPEN-18: job o proyecto libre detectado; el servidor lo resuelve a la obra vinculada. */
  site?: SiteRef;
  occurredAt: Date;
  accuracyMeters?: number;
};

type PreferenceRow = {
  mode: string;
  autoStartConsentedAt: Date | null;
  autoStartRevokedAt: Date | null;
  policyVersion: number;
};

type EventRow = {
  id: string;
  eventId: string;
  type: string;
  worksiteId: string | null;
  bindingId?: string | null;
  decision: string;
  reason: string;
  mode: string;
  policyVersion: number;
  accuracyBucket: string;
  occurredAt: Date;
  createdAt: Date;
};

@Injectable()
export class GeofenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  private assertEnabled(): void {
    if (!isGeofencePolicyEnabled()) {
      throw new NotFoundException();
    }
  }

  private prefView(row: PreferenceRow | null) {
    const mode = (row?.mode ?? "ASK") as LocationMode;
    const consent = !!row?.autoStartConsentedAt && !row?.autoStartRevokedAt;
    return {
      mode,
      autoStartConsent: consent,
      // Un AUTO sin consentimiento vigente se comporta como ASK.
      effectiveMode: mode === "AUTO" && !consent ? ("ASK" as LocationMode) : mode,
      policyVersion: row?.policyVersion ?? 1
    };
  }

  async getPreference(user: GeofenceActor) {
    this.assertEnabled();
    const row = await this.prisma.locationPreference.findFirst({ where: { tenantId: user.tenantId, userId: user.userId } });
    return this.prefView(row);
  }

  async setPreference(user: GeofenceActor, requestId: string, input: { mode: LocationMode; autoStartConsent?: boolean }) {
    this.assertEnabled();
    const existing = await this.prisma.locationPreference.findFirst({ where: { tenantId: user.tenantId, userId: user.userId } });
    const hadConsent = !!existing?.autoStartConsentedAt && !existing?.autoStartRevokedAt;
    if (input.mode === "AUTO" && !hadConsent && input.autoStartConsent !== true) {
      throw new UnprocessableEntityException("AUTO exige tu consentimiento específico de auto-inicio");
    }
    const now = new Date();
    const data: Record<string, unknown> = { mode: input.mode, policyVersion: (existing?.policyVersion ?? 0) + 1 };
    if (input.mode === "AUTO") {
      if (!hadConsent) {
        data.autoStartConsentedAt = now;
        data.autoStartRevokedAt = null;
      }
    } else if (hadConsent) {
      // Salir de AUTO revoca el consentimiento: volver a AUTO exige darlo otra vez.
      data.autoStartRevokedAt = now;
    }
    let row: PreferenceRow;
    if (existing) {
      await this.prisma.locationPreference.updateMany({ where: { tenantId: user.tenantId, userId: user.userId }, data });
      row = { ...existing, ...(data as Partial<PreferenceRow>) } as PreferenceRow;
    } else {
      row = await this.prisma.locationPreference.create({
        data: { tenantId: user.tenantId, userId: user.userId, ...data }
      });
    }
    await this.audit.append({
      tenantId: user.tenantId,
      orgId: user.orgId,
      actorUserId: user.userId,
      action: "location_preference.changed",
      entityType: "LocationPreference",
      entityId: user.userId,
      requestId,
      timestamp: now.toISOString(),
      afterJson: { mode: input.mode, autoStartConsent: input.mode === "AUTO" }
    });
    return this.prefView(row);
  }

  async evaluate(user: GeofenceActor, input: EventInput) {
    this.assertEnabled();
    const existing = await this.prisma.geofenceEvent.findFirst({
      where: { tenantId: user.tenantId, userId: user.userId, eventId: input.eventId }
    });
    if (existing) return { ...this.eventView(existing), replayed: true };

    const pref = this.prefView(
      await this.prisma.locationPreference.findFirst({ where: { tenantId: user.tenantId, userId: user.userId } })
    );

    let siteAllowed = false;
    let orgId = user.orgId;
    let worksiteId: string | null = input.worksiteId ?? null;
    let bindingId: string | null = null;
    // OPEN-18: con SEMSE_WORKSITE_BINDING_ENABLED apagado, `site` se ignora y nada cambia (AC-01).
    const bindingOn = isWorksiteBindingEnabled();
    let siteVerified: boolean | undefined;
    if (bindingOn && input.site) {
      const resolved = await resolveSiteForWorker(this.prisma, user, input.site);
      if (resolved) {
        if (input.worksiteId && input.worksiteId !== resolved.worksite.id) {
          throw new UnprocessableEntityException("La obra indicada no coincide con la obra vinculada a ese sitio");
        }
        siteAllowed = true;
        orgId = resolved.worksite.orgId;
        worksiteId = resolved.worksite.id;
        bindingId = resolved.binding.id;
        siteVerified = resolved.verified;
      } else {
        siteVerified = false;
      }
    } else if (input.worksiteId) {
      const worksite = await this.prisma.worksite.findFirst({ where: { id: input.worksiteId, tenantId: user.tenantId } });
      if (worksite) {
        const member = await this.prisma.membership.findMany({
          where: { userId: user.userId, orgId: worksite.orgId, status: "ACTIVE", org: { tenantId: user.tenantId } }
        });
        if (member.length > 0) {
          siteAllowed = true;
          orgId = worksite.orgId;
        }
        // AC-02: con el flag encendido, una obra sin ubicación verificada nunca auto-inicia.
        if (bindingOn) siteVerified = isWorksiteLocationVerified(worksite);
      }
    }

    const active = await this.prisma.timeEntry.findFirst({
      where: { tenantId: user.tenantId, createdBy: user.userId, status: "running" }
    });

    const now = Date.now();
    const recent = await this.prisma.geofenceEvent.findMany({
      where: { tenantId: user.tenantId, userId: user.userId, type: input.type, worksiteId }
    });
    const recentDuplicate = recent.some((e) => e.decision !== "IGNORE" && now - e.createdAt.getTime() < COOLDOWN_MS);

    const bucket = accuracyBucket(input.accuracyMeters);
    const result = decide({
      mode: pref.mode,
      autoConsent: pref.autoStartConsent,
      type: input.type,
      accuracy: bucket,
      activeSession: !!active,
      siteAllowed,
      ageMs: now - input.occurredAt.getTime(),
      recentDuplicate,
      siteVerified
    });

    try {
      const row = await this.prisma.geofenceEvent.create({
        data: {
          tenantId: user.tenantId,
          orgId,
          userId: user.userId,
          eventId: input.eventId,
          type: input.type,
          worksiteId,
          ...(bindingId ? { bindingId } : {}),
          decision: result.decision,
          reason: result.reason,
          mode: pref.effectiveMode,
          policyVersion: pref.policyVersion,
          accuracyBucket: bucket,
          occurredAt: input.occurredAt
        }
      });
      return { ...this.eventView(row), replayed: false };
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") {
        const again = await this.prisma.geofenceEvent.findFirst({
          where: { tenantId: user.tenantId, userId: user.userId, eventId: input.eventId }
        });
        if (again) return { ...this.eventView(again), replayed: true };
        throw new ConflictException("El evento ya se está procesando");
      }
      throw error;
    }
  }

  /** Transparencia: la persona ve qué decidió el sistema con sus eventos (sin coordenadas, que no existen). */
  async listMine(user: GeofenceActor) {
    this.assertEnabled();
    const rows = await this.prisma.geofenceEvent.findMany({ where: { tenantId: user.tenantId, userId: user.userId } });
    return rows
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 50)
      .map((row) => this.eventView(row));
  }

  /**
   * OPEN-18: sitios que la persona puede detectar ahora, con la ubicación y el radio de la
   * OBRA (nunca coordenadas de la persona). Solo obras con coordenadas; `verified` indica si
   * pueden llegar a AUTO_START_ALLOWED.
   */
  async listSites(user: GeofenceActor): Promise<GeofenceSiteView[]> {
    this.assertEnabled();
    if (!isWorksiteBindingEnabled()) throw new NotFoundException();
    const memberships = await this.prisma.membership.findMany({
      where: { userId: user.userId, status: "ACTIVE", org: { tenantId: user.tenantId } },
      include: { role: true }
    });
    // Solo la Org de la sesión (opción A del 2026-11-25): el Time Tracker valida contra ella.
    const orgIds = [...new Set(memberships.filter((m) => m.role?.key === "WORKER").map((m) => m.orgId))]
      .filter((orgId) => orgId === user.orgId);
    if (orgIds.length === 0) return [];
    // Los filtros de elegibilidad van en la consulta, ANTES del límite: obra ACTIVE con
    // coordenadas y objetivo usable por la persona (job asignado en esa Org / proyecto propio).
    // Así el límite recorta sitios detectables, no vínculos que de todos modos se descartarían.
    const bindings = [];
    for (const orgId of orgIds) {
      const rows = await this.prisma.worksiteBinding.findMany({
        where: {
          tenantId: user.tenantId,
          orgId,
          status: "ACTIVE",
          worksite: { is: { status: "ACTIVE", latitude: { not: null }, longitude: { not: null } } },
          OR: [
            { kind: "FREE_PROJECT", freeProject: { is: { tenantId: user.tenantId, createdBy: user.userId } } },
            {
              kind: "JOB",
              job: { is: { tenantId: user.tenantId, deletedAt: null, OR: jobAssignmentWhere({ orgId, userId: user.userId }) } }
            }
          ]
        },
        orderBy: { createdAt: "desc" },
        take: MAX_GEOFENCE_SITES
      });
      bindings.push(...rows);
    }
    const sites: GeofenceSiteView[] = [];
    for (const b of bindings) {
      if (sites.length >= MAX_GEOFENCE_SITES) break;
      const targetId = b.kind === "JOB" ? b.jobId : b.freeProjectId;
      if (!targetId) continue;
      const resolved = await resolveSiteForWorker(this.prisma, user, { kind: b.kind as SiteRef["kind"], id: targetId });
      if (!resolved || resolved.worksite.latitude == null || resolved.worksite.longitude == null) continue;
      sites.push({
        kind: b.kind as GeofenceSiteView["kind"],
        targetId,
        worksiteId: resolved.worksite.id,
        worksiteName: resolved.worksite.name,
        latitude: Number(resolved.worksite.latitude),
        longitude: Number(resolved.worksite.longitude),
        radiusMeters: resolved.worksite.radiusMeters,
        verified: resolved.verified
      });
    }
    return sites;
  }

  private eventView(row: EventRow) {
    return {
      id: row.id,
      eventId: row.eventId,
      type: row.type as GeofenceType,
      worksiteId: row.worksiteId,
      bindingId: row.bindingId ?? null,
      decision: row.decision as GeofenceDecision,
      reason: row.reason,
      mode: row.mode,
      policyVersion: row.policyVersion,
      accuracy: row.accuracyBucket,
      occurredAt: row.occurredAt,
      decidedAt: row.createdAt
    };
  }
}
