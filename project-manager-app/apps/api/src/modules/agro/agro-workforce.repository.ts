import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { AgroAuditRepository } from "./agro-audit.repository.js";

type AuditInput = Parameters<AgroAuditRepository["record"]>[0];

const CAPABILITY_INCLUDE = {
  specialty: { select: { id: true, key: true, name: true, sector: true, species: true } },
  parent: { select: { id: true, key: true, name: true } },
} as const;

@Injectable()
export class AgroWorkforceRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AgroAuditRepository,
  ) {}

  // ── Catálogo ────────────────────────────────────────────────────────────────

  async listRoles(includeInactive = false) {
    return this.prisma.agroRole.findMany({
      where: includeInactive ? {} : { active: true },
      include: { specialties: { include: { specialty: { select: { id: true, key: true, name: true } } } } },
      orderBy: [{ sector: "asc" }, { name: "asc" }],
    });
  }

  async listSpecialties(includeInactive = false) {
    return this.prisma.agroSpecialty.findMany({
      where: includeInactive ? {} : { active: true },
      include: { roles: { include: { role: { select: { id: true, key: true, name: true } } } } },
      orderBy: [{ sector: "asc" }, { name: "asc" }],
    });
  }

  async listCapabilities(includeInactive = false) {
    return this.prisma.agroCapability.findMany({
      where: includeInactive ? {} : { active: true },
      include: CAPABILITY_INCLUDE,
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
  }

  async findRole(idOrKey: string) {
    return this.prisma.agroRole.findFirst({ where: { OR: [{ id: idOrKey }, { key: idOrKey }] } });
  }

  async findSpecialtiesByKeys(keys: string[]) {
    if (keys.length === 0) return [];
    return this.prisma.agroSpecialty.findMany({ where: { key: { in: keys } } });
  }

  async findRolesByKeys(keys: string[]) {
    if (keys.length === 0) return [];
    return this.prisma.agroRole.findMany({ where: { key: { in: keys } } });
  }

  async findCapability(idOrKey: string) {
    return this.prisma.agroCapability.findFirst({
      where: { OR: [{ id: idOrKey }, { key: idOrKey }] },
      include: CAPABILITY_INCLUDE,
    });
  }

  async catalogKeyExists(model: "role" | "specialty" | "capability", key: string) {
    const where = { key };
    const row = model === "role"
      ? await this.prisma.agroRole.findUnique({ where })
      : model === "specialty"
        ? await this.prisma.agroSpecialty.findUnique({ where })
        : await this.prisma.agroCapability.findUnique({ where });
    return Boolean(row);
  }

  async createRole(data: { key: string; name: string; sector: string; species?: string; description?: string }, specialtyIds: string[]) {
    return this.prisma.agroRole.create({
      data: { ...data, specialties: { create: specialtyIds.map((specialtyId) => ({ specialtyId })) } },
    });
  }

  async createSpecialty(data: { key: string; name: string; sector: string; species?: string; description?: string }, roleIds: string[]) {
    return this.prisma.agroSpecialty.create({
      data: { ...data, roles: { create: roleIds.map((roleId) => ({ roleId })) } },
    });
  }

  async createCapability(data: {
    key: string; name: string; category: string; description?: string;
    specialtyId?: string | null; parentId?: string | null;
    requiresProfessional?: boolean; evidenceRequired?: boolean; validityDays?: number | null;
  }) {
    return this.prisma.agroCapability.create({ data, include: CAPABILITY_INCLUDE });
  }

  async capabilityParentOf(id: string): Promise<string | null> {
    const row = await this.prisma.agroCapability.findUnique({ where: { id }, select: { parentId: true } });
    return row?.parentId ?? null;
  }

  // ── Miembros de finca ───────────────────────────────────────────────────────

  async listMembers(farmId: string) {
    return this.prisma.agroFarmMember.findMany({ where: { farmId }, orderBy: [{ status: "asc" }, { createdAt: "asc" }] });
  }

  async findMember(farmId: string, userId: string) {
    return this.prisma.agroFarmMember.findUnique({ where: { farmId_userId: { farmId, userId } } });
  }

  async findMemberById(memberId: string) {
    return this.prisma.agroFarmMember.findUnique({ where: { id: memberId } });
  }

  async upsertMember(input: { farmId: string; userId: string; role: string; displayName?: string; invitedById: string }) {
    return this.prisma.agroFarmMember.upsert({
      where: { farmId_userId: { farmId: input.farmId, userId: input.userId } },
      create: { ...input, status: "ACTIVE" },
      update: { role: input.role, status: "ACTIVE", ...(input.displayName !== undefined && { displayName: input.displayName }) },
    });
  }

  async updateMember(memberId: string, patch: { role?: string; status?: string; displayName?: string }) {
    return this.prisma.agroFarmMember.update({ where: { id: memberId }, data: patch });
  }

  async userExists(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    return Boolean(user);
  }

  async findFarm(farmId: string) {
    return this.prisma.agroFarm.findUnique({ where: { id: farmId }, select: { id: true, ownerId: true, name: true } });
  }

  // ── Roles y capacidades del trabajador ─────────────────────────────────────

  async listWorkerRoles(userIds: string[]) {
    return this.prisma.agroWorkerRole.findMany({
      where: { userId: { in: userIds } },
      include: {
        role: {
          include: { specialties: { include: { specialty: { select: { id: true, key: true, name: true } } } } },
        },
      },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    });
  }

  async upsertWorkerRole(input: {
    userId: string; roleId: string; isPrimary: boolean; source: string; farmId: string; assignedById: string;
  }, audit: AuditInput) {
    return this.prisma.$transaction(async (tx) => {
      if (input.isPrimary) {
        await tx.agroWorkerRole.updateMany({ where: { userId: input.userId, isPrimary: true }, data: { isPrimary: false } });
      }
      const row = await tx.agroWorkerRole.upsert({
        where: { userId_roleId: { userId: input.userId, roleId: input.roleId } },
        create: input,
        update: { isPrimary: input.isPrimary, source: input.source, farmId: input.farmId, assignedById: input.assignedById },
        include: { role: true },
      });
      await this.audit.record({ ...audit, entityId: row.id }, tx);
      return row;
    });
  }

  async listWorkerCapabilities(userIds: string[]) {
    return this.prisma.agroWorkerCapability.findMany({
      where: { userId: { in: userIds } },
      include: { capability: { include: CAPABILITY_INCLUDE } },
      orderBy: { createdAt: "asc" },
    });
  }

  async findWorkerCapability(id: string) {
    return this.prisma.agroWorkerCapability.findUnique({
      where: { id },
      include: { capability: { include: CAPABILITY_INCLUDE } },
    });
  }

  async findWorkerCapabilityFor(userId: string, capabilityId: string) {
    return this.prisma.agroWorkerCapability.findUnique({ where: { userId_capabilityId: { userId, capabilityId } } });
  }

  async saveDeclaration(input: {
    userId: string; capabilityId: string; level: string; source: string; farmId: string;
    acquiredAt?: Date | null; metadata?: Record<string, unknown>;
  }, audit: AuditInput) {
    return this.prisma.$transaction(async (tx) => {
      const data = {
        level: input.level,
        status: "SELF_REPORTED",
        source: input.source,
        farmId: input.farmId,
        acquiredAt: input.acquiredAt ?? null,
        verifiedAt: null,
        expiresAt: null,
        ...(input.metadata !== undefined && { metadata: input.metadata as any }),
      };
      const row = await tx.agroWorkerCapability.upsert({
        where: { userId_capabilityId: { userId: input.userId, capabilityId: input.capabilityId } },
        create: { userId: input.userId, capabilityId: input.capabilityId, ...data },
        update: data,
      });
      await this.audit.record({ ...audit, entityId: row.id }, tx);
      return row;
    });
  }

  async updateWorkerCapabilityStatus(id: string, patch: { status: string; farmId: string }, audit: AuditInput) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.agroWorkerCapability.update({ where: { id }, data: patch });
      await this.audit.record(audit, tx);
      return row;
    });
  }

  /** Verificación / rechazo / revocación: registro append-only + estado + auditoría, atómico. */
  async applyVerification(input: {
    verification: {
      workerCapabilityId: string; capabilityId: string; userId: string; verifierId: string;
      verifierFarmRole: string; farmId: string; method: string; result: string;
      levelAssessed?: string | null; evidenceIds: string[]; notes?: string | null;
      verifiedAt: Date; expiresAt?: Date | null;
    };
    capabilityPatch: {
      status: string; level?: string; verifiedAt?: Date | null; expiresAt?: Date | null; source?: string;
    };
  }, audit: AuditInput) {
    return this.prisma.$transaction(async (tx) => {
      const verification = await tx.agroCapabilityVerification.create({ data: input.verification });
      const workerCapability = await tx.agroWorkerCapability.update({
        where: { id: input.verification.workerCapabilityId },
        data: { ...input.capabilityPatch, farmId: input.verification.farmId, lastVerificationId: verification.id },
      });
      await this.audit.record({ ...audit, after: { ...(audit.after as object), verificationId: verification.id } }, tx);
      return { verification, workerCapability };
    });
  }

  async listVerifications(workerCapabilityIds: string[]) {
    if (workerCapabilityIds.length === 0) return [];
    return this.prisma.agroCapabilityVerification.findMany({
      where: { workerCapabilityId: { in: workerCapabilityIds } },
      orderBy: { verifiedAt: "desc" },
    });
  }
}
