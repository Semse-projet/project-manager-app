import type { Prisma } from "@prisma/client";

/**
 * Regla ÚNICA de qué trabajos puede ver un actor dentro de su tenant (2.27). La usan `JobsRepository` (listado y
 * detalle) y el contexto operativo de Prometeo (0.39), para que el asistente no muestre lo que la API de trabajos
 * ya no entrega:
 *  - OPS_ADMIN: todo el tenant (visibilidad operativa intencional).
 *  - PRO/WORKER: trabajos publicados (abiertos a ofertas) más aquellos en los que ya participa (oferta, reserva,
 *    contrato o asignación de proyecto de su organización).
 *  - CLIENT y cualquier otro rol: solo los de su organización cliente (denegar por defecto).
 */
export function buildJobVisibilityWhere(input: {
  orgId: string;
  userId: string;
  roles: string[];
}): Prisma.JobWhereInput {
  const isOpsAdmin = input.roles.includes("OPS_ADMIN");
  const isPro = input.roles.includes("PRO") || input.roles.includes("WORKER");

  if (isOpsAdmin) {
    return {};
  }
  if (isPro) {
    return {
      OR: [
        { status: { in: ["POSTED", "PUBLISHED"] } },
        { bids: { some: { professionalUserId: input.userId } } },
        {
          reservations: {
            some: {
              status: { in: ["ACTIVE", "ACCEPTED"] },
              OR: [{ professionalId: input.userId }, { professionalOrgId: input.orgId }]
            }
          }
        },
        {
          contract: {
            is: {
              deletedAt: null,
              OR: [{ professionalUserId: input.userId }, { professionalOrgId: input.orgId }]
            }
          }
        },
        { project: { is: { assignedProOrgId: input.orgId } } }
      ]
    };
  }
  return { clientOrgId: input.orgId };
}

/** `own-org` = el actor solo ve los trabajos de su organización cliente (la proyección por `clientOrgId` sirve). */
export function jobVisibilityKind(roles: string[]): "tenant" | "marketplace" | "own-org" {
  if (roles.includes("OPS_ADMIN")) return "tenant";
  if (roles.includes("PRO") || roles.includes("WORKER")) return "marketplace";
  return "own-org";
}
