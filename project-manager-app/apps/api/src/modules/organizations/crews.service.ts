import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException
} from "@nestjs/common";
import { hasPermission } from "../../common/rbac.js";
import { AuditService } from "../../infrastructure/audit/audit.service.js";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

/**
 * BO-07 — obras (Worksite) y cuadrillas (Crew) de una Org.
 * Spec: docs/specs/core/crews-worksites.spec.md
 *
 * Supuestos conservadores: el supervisor de una cuadrilla es un WORKER activo de
 * la Org (no se crea un rol de plataforma nuevo); toda lectura/escritura se
 * revalida contra la Membership ACTIVE vigente, nunca contra claims de sesión.
 */

const MANAGE = "org:crews:manage";

export type CrewActor = { tenantId: string; orgId: string; userId: string; roles: string[] };

export function isCrewsEnabled(): boolean {
  return process.env.SEMSE_CREWS_ENABLED === "true";
}

@Injectable()
export class CrewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService
  ) {}

  private assertEnabled(): void {
    if (!isCrewsEnabled()) {
      throw new NotFoundException();
    }
  }

  private async requireManage(actor: CrewActor, orgId: string): Promise<void> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId: actor.userId, orgId, status: "ACTIVE", org: { tenantId: actor.tenantId } },
      include: { role: true }
    });
    if (memberships.length === 0) {
      throw new NotFoundException();
    }
    if (!hasPermission(memberships.map((m) => m.role.key), MANAGE)) {
      throw new ForbiddenException();
    }
  }

  private async assertActiveWorker(tenantId: string, orgId: string, userId: string): Promise<void> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId, orgId, status: "ACTIVE", org: { tenantId } },
      include: { role: true }
    });
    if (!memberships.some((m) => m.role.key === "WORKER")) {
      throw new UnprocessableEntityException("La persona debe ser un trabajador activo de la organización");
    }
  }

  private async hasActiveWorkerMembership(tenantId: string, orgId: string, userId: string): Promise<boolean> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId, orgId, status: "ACTIVE", org: { tenantId } },
      include: { role: true }
    });
    return memberships.some((membership) => membership.role.key === "WORKER");
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

  async createWorksite(actor: CrewActor, orgId: string, requestId: string, input: { name: string; address?: string }) {
    this.assertEnabled();
    await this.requireManage(actor, orgId);
    const site = await this.prisma.worksite.create({
      data: { tenantId: actor.tenantId, orgId, name: input.name, address: input.address ?? null, createdBy: actor.userId }
    });
    await this.record(actor, orgId, "worksite.created", "Worksite", site.id, requestId, {});
    return { worksiteId: site.id, name: site.name, address: site.address, status: site.status };
  }

  async listWorksites(actor: CrewActor, orgId: string) {
    this.assertEnabled();
    await this.requireManage(actor, orgId);
    const rows = await this.prisma.worksite.findMany({
      where: { tenantId: actor.tenantId, orgId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      take: 200
    });
    return rows.map((s) => ({ worksiteId: s.id, name: s.name, address: s.address, status: s.status }));
  }

  async createCrew(
    actor: CrewActor,
    orgId: string,
    requestId: string,
    input: { name: string; supervisorUserId: string; worksiteId?: string }
  ) {
    this.assertEnabled();
    await this.requireManage(actor, orgId);
    await this.assertActiveWorker(actor.tenantId, orgId, input.supervisorUserId);
    if (input.worksiteId) {
      const site = await this.prisma.worksite.findFirst({
        where: { id: input.worksiteId, tenantId: actor.tenantId, orgId, status: "ACTIVE" }
      });
      if (!site) {
        throw new UnprocessableEntityException("Obra no válida para esta organización");
      }
    }
    const crew = await this.prisma.crew.create({
      data: {
        tenantId: actor.tenantId,
        orgId,
        name: input.name,
        supervisorUserId: input.supervisorUserId,
        worksiteId: input.worksiteId ?? null,
        createdBy: actor.userId
      }
    });
    await this.record(actor, orgId, "crew.created", "Crew", crew.id, requestId, { supervisorUserId: input.supervisorUserId });
    return this.crewView(crew);
  }

  async listCrews(actor: CrewActor, orgId: string) {
    this.assertEnabled();
    await this.requireManage(actor, orgId);
    const rows = await this.prisma.crew.findMany({
      where: { tenantId: actor.tenantId, orgId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      take: 200
    });
    return rows.map((c) => this.crewView(c));
  }

  async addMember(actor: CrewActor, orgId: string, crewId: string, userId: string, requestId: string) {
    this.assertEnabled();
    await this.requireManage(actor, orgId);
    const crew = await this.prisma.crew.findFirst({ where: { id: crewId, tenantId: actor.tenantId, orgId, status: "ACTIVE" } });
    if (!crew) throw new NotFoundException();
    await this.assertActiveWorker(actor.tenantId, orgId, userId);
    const existing = await this.prisma.crewMember.findFirst({ where: { crewId, userId, status: "ACTIVE" } });
    if (existing) {
      return { crewId, userId, status: "ACTIVE" as const };
    }
    await this.prisma.crewMember.create({ data: { crewId, userId, addedBy: actor.userId } });
    await this.record(actor, orgId, "crew.member_added", "Crew", crewId, requestId, { userId });
    return { crewId, userId, status: "ACTIVE" as const };
  }

  async removeMember(actor: CrewActor, orgId: string, crewId: string, userId: string, requestId: string) {
    this.assertEnabled();
    await this.requireManage(actor, orgId);
    const crew = await this.prisma.crew.findFirst({ where: { id: crewId, tenantId: actor.tenantId, orgId } });
    if (!crew) throw new NotFoundException();
    const result = await this.prisma.crewMember.updateMany({
      where: { crewId, userId, status: "ACTIVE" },
      data: { status: "REMOVED", removedAt: new Date(), removedBy: actor.userId }
    });
    if (result.count === 0) {
      throw new ConflictException("La persona no es miembro activo de la cuadrilla");
    }
    await this.record(actor, orgId, "crew.member_removed", "Crew", crewId, requestId, { userId });
    return { crewId, userId, status: "REMOVED" as const };
  }

  async archiveCrew(actor: CrewActor, orgId: string, crewId: string, requestId: string) {
    this.assertEnabled();
    await this.requireManage(actor, orgId);
    const result = await this.prisma.crew.updateMany({
      where: { id: crewId, tenantId: actor.tenantId, orgId, status: "ACTIVE" },
      data: { status: "ARCHIVED" }
    });
    if (result.count === 0) {
      const row = await this.prisma.crew.findFirst({ where: { id: crewId, tenantId: actor.tenantId, orgId } });
      if (!row) throw new NotFoundException();
      throw new ConflictException("La cuadrilla ya está archivada");
    }
    await this.record(actor, orgId, "crew.archived", "Crew", crewId, requestId, {});
    return { status: "ARCHIVED" };
  }

  /** Cuadrillas donde la persona supervisa o es miembro, solo en Orgs donde su Membership sigue ACTIVE. */
  async listMine(user: { tenantId: string; userId: string }) {
    this.assertEnabled();
    const asMember = await this.prisma.crewMember.findMany({ where: { userId: user.userId, status: "ACTIVE" } });
    const memberCrewIds = asMember.map((m) => m.crewId);
    const supervised = await this.prisma.crew.findMany({ where: { tenantId: user.tenantId, supervisorUserId: user.userId, status: "ACTIVE" } });
    const memberCrews = memberCrewIds.length
      ? await this.prisma.crew.findMany({ where: { id: { in: memberCrewIds }, tenantId: user.tenantId, status: "ACTIVE" } })
      : [];
    const all = [...supervised, ...memberCrews.filter((c) => !supervised.some((s) => s.id === c.id))];
    const visible = [];
    for (const crew of all) {
      const activeWorker = await this.hasActiveWorkerMembership(crew.tenantId, crew.orgId, user.userId);
      if (activeWorker) {
        visible.push({ ...this.crewView(crew), myRole: crew.supervisorUserId === user.userId ? "SUPERVISOR" : "MEMBER" });
      }
    }
    return visible;
  }

  /** Lista de miembros: solo el supervisor vigente de ESA cuadrilla (membresía ACTIVE revalidada). */
  async rosterForSupervisor(user: { tenantId: string; userId: string }, crewId: string) {
    this.assertEnabled();
    const crew = await this.prisma.crew.findFirst({ where: { id: crewId, tenantId: user.tenantId, supervisorUserId: user.userId, status: "ACTIVE" } });
    if (!crew) throw new NotFoundException();
    if (!(await this.hasActiveWorkerMembership(crew.tenantId, crew.orgId, user.userId))) throw new NotFoundException();
    const members = await this.prisma.crewMember.findMany({ where: { crewId, status: "ACTIVE" } });
    return { crewId, members: members.map((m) => ({ userId: m.userId, addedAt: m.addedAt })) };
  }

  private crewView(crew: { id: string; orgId: string; name: string; supervisorUserId: string; worksiteId: string | null; status: string }) {
    return {
      crewId: crew.id,
      orgId: crew.orgId,
      name: crew.name,
      supervisorUserId: crew.supervisorUserId,
      worksiteId: crew.worksiteId,
      status: crew.status
    };
  }
}
