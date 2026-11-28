import type { SiteKind, SiteRef } from "@semse/schemas";
import { jobAssignmentWhere } from "../../common/job-assignment.js";

/**
 * OPEN-18 — vínculo obra ↔ Job/proyecto libre y resolución del sitio de un evento.
 * Spec: docs/specs/core/worksite-location-binding.spec.md
 *
 * Fuente única de la regla «¿esta persona puede usar este sitio?», compartida por la
 * evaluación de eventos, la lista de sitios detectables y el consumo de una decisión
 * AUTO_START_ALLOWED al iniciar un TimeEntry. Todo se revalida desde la base en cada
 * llamada (nunca desde la sesión): una membresía revocada o un vínculo terminado dejan
 * de valer de inmediato (AC-05, AC-10).
 */

export type { SiteKind, SiteRef };

export const VERIFIED_LOCATION_SOURCES = ["manual_pin", "onsite_capture"] as const;

export function isWorksiteBindingEnabled(): boolean {
  return process.env.SEMSE_WORKSITE_BINDING_ENABLED === "true";
}

/** Clave única mientras el vínculo está ACTIVE (un solo vínculo activo por objetivo). */
export function activeTargetKey(tenantId: string, site: SiteRef): string {
  return `${tenantId}:${site.kind}:${site.id}`;
}

type WorksiteLocation = {
  latitude: unknown;
  longitude: unknown;
  radiusMeters: number | null;
  locationSource: string | null;
  locationVerifiedAt: Date | null;
};

/** AC-02/AC-03: solo un pin manual o una captura en sitio, con fecha y autor, cuentan como verificados. */
export function isWorksiteLocationVerified(ws: WorksiteLocation): boolean {
  return (
    ws.latitude != null &&
    ws.longitude != null &&
    ws.radiusMeters != null &&
    ws.locationVerifiedAt != null &&
    (VERIFIED_LOCATION_SOURCES as readonly string[]).includes(ws.locationSource ?? "")
  );
}

export type ResolvedWorksite = WorksiteLocation & {
  id: string;
  tenantId: string;
  orgId: string;
  name: string;
  status: string;
};

export type ResolvedSite = {
  binding: { id: string; kind: string; jobId: string | null; freeProjectId: string | null; worksiteId: string };
  worksite: ResolvedWorksite;
  verified: boolean;
};

// Mínimo que necesita la resolución; lo cumplen PrismaService y un cliente de transacción.
export type SitePrisma = {
  worksiteBinding: { findFirst(args: unknown): Promise<any> };
  membership: { findMany(args: unknown): Promise<any[]> };
  job: { findFirst(args: unknown): Promise<any> };
  freeProject: { findFirst(args: unknown): Promise<any> };
  locationPreference: { findFirst(args: unknown): Promise<any> };
};

/**
 * Consentimiento de auto-inicio vigente (modo AUTO, consentido y no revocado). Se revalida al
 * consumir una decisión: salir de AUTO después de recibir AUTO_START_ALLOWED la invalida.
 */
export async function hasLiveAutoConsent(prisma: SitePrisma, user: { tenantId: string; userId: string }): Promise<boolean> {
  const pref = await prisma.locationPreference.findFirst({ where: { tenantId: user.tenantId, userId: user.userId } });
  return pref?.mode === "AUTO" && !!pref.autoStartConsentedAt && !pref.autoStartRevokedAt;
}

/**
 * Devuelve el sitio solo si TODO se cumple; si no, null (sin oráculo de existencia):
 * vínculo ACTIVE del tenant, obra ACTIVE, Membership WORKER ACTIVE de la persona en la Org
 * de la obra y, para JOB, que el trabajo esté asignado a la persona (misma regla que el
 * Time Tracker); para FREE_PROJECT, que la persona sea su creadora.
 *
 * Con `orgId` (la Org de la sesión), la obra debe pertenecer a esa Org (decisión del
 * propietario del 2026-11-25, opción A): el Time Tracker valida la asignación contra la Org
 * de la sesión, así que una obra de otra Org daría una decisión que el reloj rechazaría.
 * Las obras de otra Org aparecen al cambiar de sesión a esa Org.
 */
export async function resolveSiteForWorker(
  prisma: SitePrisma,
  user: { tenantId: string; userId: string; orgId?: string },
  site: SiteRef
): Promise<ResolvedSite | null> {
  const binding = await prisma.worksiteBinding.findFirst({
    where: { tenantId: user.tenantId, activeTargetKey: activeTargetKey(user.tenantId, site), status: "ACTIVE" },
    include: { worksite: true }
  });
  const worksite = binding?.worksite as ResolvedWorksite | undefined;
  if (!binding || !worksite || worksite.status !== "ACTIVE" || worksite.tenantId !== user.tenantId) return null;
  if (user.orgId !== undefined && worksite.orgId !== user.orgId) return null;

  const memberships = await prisma.membership.findMany({
    where: { userId: user.userId, orgId: worksite.orgId, status: "ACTIVE", org: { tenantId: user.tenantId } },
    include: { role: true }
  });
  if (!memberships.some((m) => m.role?.key === "WORKER")) return null;

  if (site.kind === "JOB") {
    const job = await prisma.job.findFirst({
      where: {
        id: site.id,
        tenantId: user.tenantId,
        deletedAt: null,
        OR: jobAssignmentWhere({ orgId: worksite.orgId, userId: user.userId })
      },
      select: { id: true }
    });
    if (!job) return null;
  } else {
    const project = await prisma.freeProject.findFirst({
      where: { id: site.id, tenantId: user.tenantId, createdBy: user.userId },
      select: { id: true }
    });
    if (!project) return null;
  }

  return {
    binding: {
      id: binding.id,
      kind: binding.kind,
      jobId: binding.jobId ?? null,
      freeProjectId: binding.freeProjectId ?? null,
      worksiteId: binding.worksiteId
    },
    worksite,
    verified: isWorksiteLocationVerified(worksite)
  };
}
