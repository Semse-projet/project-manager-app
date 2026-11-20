import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException
} from "@nestjs/common";
import { hasPermission } from "../../common/rbac.js";
import { hasScopeAccess } from "../../common/resource-scope.js";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import {
  WORKSITE_RADIUS_METERS,
  type WorksiteBindingInput,
  type WorksiteBindingView,
  type WorksiteLocationInput,
  type WorksiteLocationView
} from "@semse/schemas";
import { activeTargetKey, isWorksiteBindingEnabled, isWorksiteLocationVerified } from "../geofence/site-binding.js";
import { isCrewsEnabled, type CrewActor } from "./crews.service.js";

/**
 * OPEN-18 — ubicación verificable de la obra y vínculo obra ↔ Job/proyecto libre.
 * Spec: docs/specs/core/worksite-location-binding.spec.md
 *
 * Vive en el módulo dueño de las obras (BO-07): nunca escribe en Job ni en FreeProject.
 * Exige SEMSE_CREWS_ENABLED y SEMSE_WORKSITE_BINDING_ENABLED (apagado → 404).
 */

const MANAGE = "org:crews:manage";

export type LocationInput = WorksiteLocationInput;
export type BindingInput = WorksiteBindingInput;

type BindingRow = {
  id: string;
  worksiteId: string;
  kind: string;
  jobId: string | null;
  freeProjectId: string | null;
  status: string;
  createdBy: string;
  createdAt: Date;
  endedAt: Date | null;
};

@Injectable()
export class WorksiteLocationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  private assertEnabled(): void {
    if (!isCrewsEnabled() || !isWorksiteBindingEnabled()) {
      throw new NotFoundException();
    }
  }

  /** AC de BO-07: Membership ACTIVE en esa Org y tenant (si no → 404) y `org:crews:manage` (si no → 403). */
  private async requireManage(actor: CrewActor, orgId: string): Promise<void> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId: actor.userId, orgId, status: "ACTIVE", org: { tenantId: actor.tenantId } },
      include: { role: true }
    });
    if (memberships.length === 0) throw new NotFoundException();
    if (!hasPermission(memberships.map((m) => m.role.key), MANAGE)) throw new ForbiddenException();
  }

  private async activeWorksite(actor: CrewActor, orgId: string, worksiteId: string) {
    const site = await this.prisma.worksite.findFirst({
      where: { id: worksiteId, tenantId: actor.tenantId, orgId, status: "ACTIVE" }
    });
    if (!site) throw new NotFoundException();
    return site;
  }

  private async record(
    actor: CrewActor,
    orgId: string,
    action: string,
    entityType: string,
    entityId: string,
    requestId: string,
    afterJson: Record<string, unknown>
  ): Promise<void> {
    await this.audit.append({
      tenantId: actor.tenantId,
      orgId,
      actorUserId: actor.userId,
      action,
      entityType,
      entityId,
      requestId,
      timestamp: new Date().toISOString(),
      afterJson
    });
  }

  /** Fija la ubicación de la obra. Pin manual o captura en sitio quedan verificados (fecha y autor); geocodificada, no. */
  async setLocation(actor: CrewActor, orgId: string, worksiteId: string, requestId: string, input: LocationInput) {
    this.assertEnabled();
    await this.requireManage(actor, orgId);
    await this.activeWorksite(actor, orgId, worksiteId);
    const verified = input.source === "manual_pin" || input.source === "onsite_capture";
    const radiusMeters = input.radiusMeters ?? WORKSITE_RADIUS_METERS.default;
    if (!Number.isInteger(radiusMeters) || radiusMeters < WORKSITE_RADIUS_METERS.min || radiusMeters > WORKSITE_RADIUS_METERS.max) {
      throw new UnprocessableEntityException("El radio de la obra debe estar entre 50 y 1000 m");
    }
    const now = new Date();
    await this.prisma.worksite.updateMany({
      where: { id: worksiteId, tenantId: actor.tenantId, orgId, status: "ACTIVE" },
      data: {
        latitude: input.latitude,
        longitude: input.longitude,
        radiusMeters,
        locationSource: input.source,
        locationVerifiedAt: verified ? now : null,
        locationVerifiedBy: verified ? actor.userId : null
      }
    });
    // Sin coordenadas en la auditoría: solo el radio, la procedencia y si quedó verificada.
    await this.record(actor, orgId, "worksite.location_set", "Worksite", worksiteId, requestId, {
      radiusMeters,
      source: input.source,
      verified
    });
    const site = await this.activeWorksite(actor, orgId, worksiteId);
    return this.locationView(site);
  }

  async createBinding(actor: CrewActor, orgId: string, worksiteId: string, requestId: string, input: BindingInput) {
    this.assertEnabled();
    await this.requireManage(actor, orgId);
    await this.activeWorksite(actor, orgId, worksiteId);
    await this.assertTargetInScope(actor, orgId, input);

    const key = activeTargetKey(actor.tenantId, { kind: input.kind, id: input.targetId });
    const existing = await this.prisma.worksiteBinding.findFirst({
      where: { tenantId: actor.tenantId, activeTargetKey: key, status: "ACTIVE" }
    });
    if (existing) {
      // AC-04: el mismo par es idempotente; otra obra exige terminar el vínculo anterior.
      if (existing.worksiteId === worksiteId) return this.bindingView(existing);
      throw new ConflictException("Ese trabajo o proyecto ya está vinculado a otra obra; termina ese vínculo primero");
    }
    let row: BindingRow;
    try {
      row = await this.prisma.worksiteBinding.create({
        data: {
          tenantId: actor.tenantId,
          orgId,
          worksiteId,
          kind: input.kind,
          jobId: input.kind === "JOB" ? input.targetId : null,
          freeProjectId: input.kind === "FREE_PROJECT" ? input.targetId : null,
          status: "ACTIVE",
          activeTargetKey: key,
          createdBy: actor.userId
        }
      });
    } catch (error) {
      // Carrera con otro vínculo simultáneo del mismo objetivo: el índice único decide.
      if ((error as { code?: string }).code === "P2002") {
        throw new ConflictException("Ese trabajo o proyecto ya tiene un vínculo activo");
      }
      throw error;
    }
    await this.record(actor, orgId, "worksite_binding.created", "WorksiteBinding", row.id, requestId, {
      worksiteId,
      kind: input.kind,
      targetId: input.targetId
    });
    return this.bindingView(row);
  }

  async listBindings(actor: CrewActor, orgId: string, worksiteId: string) {
    this.assertEnabled();
    await this.requireManage(actor, orgId);
    await this.activeWorksite(actor, orgId, worksiteId);
    const rows = await this.prisma.worksiteBinding.findMany({
      where: { tenantId: actor.tenantId, orgId, worksiteId },
      orderBy: { createdAt: "desc" },
      take: 200
    });
    return rows.map((r) => this.bindingView(r));
  }

  async endBinding(actor: CrewActor, orgId: string, worksiteId: string, bindingId: string, requestId: string) {
    this.assertEnabled();
    await this.requireManage(actor, orgId);
    const result = await this.prisma.worksiteBinding.updateMany({
      where: { id: bindingId, tenantId: actor.tenantId, orgId, worksiteId, status: "ACTIVE" },
      data: { status: "ENDED", activeTargetKey: null, endedAt: new Date(), endedBy: actor.userId }
    });
    if (result.count === 0) {
      const row = await this.prisma.worksiteBinding.findFirst({ where: { id: bindingId, tenantId: actor.tenantId, orgId, worksiteId } });
      if (!row) throw new NotFoundException();
      throw new ConflictException("El vínculo ya estaba terminado");
    }
    await this.record(actor, orgId, "worksite_binding.ended", "WorksiteBinding", bindingId, requestId, { worksiteId });
    return { bindingId, status: "ENDED" as const };
  }

  /**
   * JOB: del tenant, no borrado, y la Org de la obra es la org cliente o la profesional
   * asignada del proyecto (ResourceScope `read`). FREE_PROJECT: del tenant y creado por quien
   * vincula (Q1: requiere además gestionar la Org de la obra). Si no → 404, sin oráculo.
   */
  private async assertTargetInScope(actor: CrewActor, orgId: string, input: BindingInput): Promise<void> {
    if (input.kind === "JOB") {
      const job = await this.prisma.job.findFirst({
        where: { id: input.targetId, tenantId: actor.tenantId, deletedAt: null },
        select: { id: true, tenantId: true, clientOrgId: true, project: { select: { assignedProOrgId: true } } }
      });
      const inScope =
        !!job &&
        hasScopeAccess(
          { tenantId: actor.tenantId, orgId, roles: [] },
          { tenantId: job.tenantId, clientOrgId: job.clientOrgId, assignedProOrgId: job.project?.assignedProOrgId ?? null },
          "read"
        );
      if (!inScope) throw new NotFoundException();
      return;
    }
    if (input.kind === "FREE_PROJECT") {
      const project = await this.prisma.freeProject.findFirst({
        where: { id: input.targetId, tenantId: actor.tenantId, createdBy: actor.userId },
        select: { id: true }
      });
      if (!project) throw new NotFoundException();
      return;
    }
    throw new UnprocessableEntityException("Tipo de vínculo no válido");
  }

  private locationView(site: {
    id: string;
    latitude: unknown;
    longitude: unknown;
    radiusMeters: number | null;
    locationSource: string | null;
    locationVerifiedAt: Date | null;
  }): WorksiteLocationView {
    return {
      worksiteId: site.id,
      latitude: site.latitude == null ? null : Number(site.latitude),
      longitude: site.longitude == null ? null : Number(site.longitude),
      radiusMeters: site.radiusMeters,
      source: site.locationSource as WorksiteLocationView["source"],
      verified: isWorksiteLocationVerified(site),
      verifiedAt: site.locationVerifiedAt
    };
  }

  private bindingView(row: BindingRow): WorksiteBindingView {
    return {
      bindingId: row.id,
      worksiteId: row.worksiteId,
      kind: row.kind as WorksiteBindingView["kind"],
      targetId: row.kind === "JOB" ? row.jobId : row.freeProjectId,
      status: row.status as WorksiteBindingView["status"],
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      endedAt: row.endedAt
    };
  }
}
