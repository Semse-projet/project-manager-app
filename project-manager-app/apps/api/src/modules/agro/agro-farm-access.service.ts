import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import {
  canPerformAgroFarmAction,
  isAgroFarmMemberRole,
  type AgroFarmAction,
  type AgroFarmRole,
} from "./agro-farm-policy.js";

export type AgroFarmActor = {
  farmId: string;
  userId: string;
  role: AgroFarmRole;
};

/**
 * Resuelve el rol de un usuario en una finca: OWNER si es `AgroFarm.ownerId`,
 * o el rol de su `AgroFarmMember` ACTIVE. Cualquier otro caso es 404 (no se
 * filtra la existencia de fincas ajenas), igual que el `assertFarmAccess`
 * owner-only del resto de Agro.
 */
@Injectable()
export class AgroFarmAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveRole(farmId: string, userId: string): Promise<AgroFarmRole | null> {
    const farm = await this.prisma.agroFarm.findUnique({ where: { id: farmId }, select: { ownerId: true } });
    if (!farm) return null;
    if (farm.ownerId === userId) return "OWNER";
    const member = await this.prisma.agroFarmMember.findUnique({
      where: { farmId_userId: { farmId, userId } },
      select: { role: true, status: true },
    });
    if (!member || member.status !== "ACTIVE" || !isAgroFarmMemberRole(member.role)) return null;
    return member.role;
  }

  /** Exige pertenencia a la finca (cualquier rol). */
  async requireMember(farmId: string, userId: string): Promise<AgroFarmActor> {
    const role = await this.resolveRole(farmId, userId);
    if (!role) throw new NotFoundException(`Farm not found: ${farmId}`);
    return { farmId, userId, role };
  }

  /** Exige pertenencia y que el rol permita la acción. */
  async require(
    farmId: string,
    userId: string,
    action: AgroFarmAction,
    opts: { isAssignee?: boolean } = {},
  ): Promise<AgroFarmActor> {
    const actor = await this.requireMember(farmId, userId);
    assertAgroFarmAction(actor, action, opts);
    return actor;
  }

  /**
   * Tenant + owner de la finca, para emitir eventos de dominio (T-052) igual
   * que el espejo a JobTask (agro-jobtask-mirror.ts): sin tenant, no hay
   * evento cruzado — AgroAuditEvent sigue siendo el registro.
   */
  async getFarmContext(farmId: string): Promise<{ tenantId: string | null; ownerId: string | null } | null> {
    return this.prisma.agroFarm.findUnique({ where: { id: farmId }, select: { tenantId: true, ownerId: true } });
  }

  /** Fincas donde el usuario es miembro activo (no incluye las propias). */
  async listMemberships(userId: string) {
    return this.prisma.agroFarmMember.findMany({
      where: { userId, status: "ACTIVE" },
      include: { farm: { select: { id: true, name: true, operationType: true, locationLabel: true } } },
      orderBy: { createdAt: "desc" },
    });
  }
}

export function assertAgroFarmAction(
  actor: AgroFarmActor,
  action: AgroFarmAction,
  opts: { isAssignee?: boolean } = {},
): void {
  if (!canPerformAgroFarmAction(actor.role, action, opts)) {
    throw new ForbiddenException({
      message: `Farm role ${actor.role} cannot perform ${action}`,
      farmRole: actor.role,
      action,
    });
  }
}

/**
 * Autoriza una acción en una finca para los servicios Agro existentes.
 *
 * Con `AgroFarmAccessService` (inyectado por Nest) aplica la política de rol de
 * finca: propietario + miembros ACTIVE. Sin él (tests unitarios que construyen
 * el servicio a mano) conserva el comportamiento anterior a T-050: solo el
 * propietario, cualquier otro recibe 404.
 */
export async function authorizeFarmAction(
  access: AgroFarmAccessService | undefined,
  farmRepo: { findFarm(farmId: string): Promise<{ ownerId: string | null } | null> },
  farmId: string,
  userId: string,
  action: AgroFarmAction,
  opts: { isAssignee?: boolean } = {},
): Promise<AgroFarmActor> {
  if (access) return access.require(farmId, userId, action, opts);
  const farm = await farmRepo.findFarm(farmId);
  if (!farm || farm.ownerId !== userId) throw new NotFoundException(`Farm not found: ${farmId}`);
  return { farmId, userId, role: "OWNER" };
}
