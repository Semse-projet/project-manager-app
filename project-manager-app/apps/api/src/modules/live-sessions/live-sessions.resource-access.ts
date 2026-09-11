import { Injectable } from "@nestjs/common";
import type { LiveSessionScopeType } from "@semse/schemas";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

export const LIVE_SESSIONS_RESOURCE_ACCESS = Symbol("LIVE_SESSIONS_RESOURCE_ACCESS");

export type ResourceActor = {
  userId: string;
  tenantId: string;
  orgId: string;
  roles: string[];
};

/**
 * Decide si un actor puede **abrir** una LiveSession sobre un `job`/`project`.
 * Es lo único que este módulo consulta del dominio dueño del recurso
 * (spec §3, §13.1). La membresía de la sesión ya abierta (get/transition/
 * media-token/SSE) se resuelve con `LiveSessionParticipant`, no aquí.
 *
 * v1 — comprobaciones inequívocas únicamente: tenant + rol claramente ligado
 * al recurso. La contraparte que no cae en estas reglas (p. ej. el PRO
 * asignado por un flujo de contrato que este módulo no modela) se agrega a la
 * sesión de forma explícita por el `owner` vía `POST .../:id/participants`,
 * que revalida acceso — nunca se asume acceso por inferencia.
 */
export interface LiveSessionResourceAccess {
  /** `false` -> el endpoint responde 404 (no se distingue de "no existe"). */
  canOpenSession(
    actor: ResourceActor,
    scopeType: LiveSessionScopeType,
    scopeId: string,
  ): Promise<boolean>;
}

@Injectable()
export class PrismaLiveSessionResourceAccess implements LiveSessionResourceAccess {
  constructor(private readonly prisma: PrismaService) {}

  async canOpenSession(
    actor: ResourceActor,
    scopeType: LiveSessionScopeType,
    scopeId: string,
  ): Promise<boolean> {
    if (scopeType === "job") {
      const job = await this.prisma.job.findFirst({
        where: { id: scopeId, tenantId: actor.tenantId },
        select: { clientOrgId: true },
      });
      if (!job) return false;
      if (actor.roles.includes("OPS_ADMIN")) return true;
      return job.clientOrgId === actor.orgId;
    }

    const fp = await this.prisma.freeProject.findFirst({
      where: { id: scopeId, tenantId: actor.tenantId },
      select: { createdBy: true },
    });
    if (!fp) return false;
    if (actor.roles.includes("OPS_ADMIN")) return true;
    return fp.createdBy === actor.userId;
  }
}
