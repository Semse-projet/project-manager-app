export type ComplianceStatus = "compliant" | "warning" | "violation" | "pending";
export type ComplianceCategory = "legal" | "license" | "insurance" | "escrow" | "data";

export interface ComplianceItem {
  id: string;
  title: string;
  category: ComplianceCategory;
  status: ComplianceStatus;
  detail: string;
  deadline?: string;
  affectedCount?: number;
  actionLink: string;
}

export interface ComplianceSource<T> {
  available: boolean;
  data: T;
}

export interface ComplianceSnapshot {
  jobs: ComplianceSource<readonly unknown[]>;
  disputes: ComplianceSource<readonly unknown[]>;
  members: ComplianceSource<readonly unknown[]>;
  ratings: ComplianceSource<{ items: readonly unknown[] }>;
  travels: ComplianceSource<readonly unknown[]>;
}

export interface ComplianceCheckResult {
  items: ComplianceItem[];
  unavailableSources: string[];
}

export async function captureComplianceSource<T>(
  request: Promise<T>,
  fallback: T,
): Promise<ComplianceSource<T>> {
  try {
    return { available: true, data: await request };
  } catch {
    return { available: false, data: fallback };
  }
}

function asRow(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : {};
}

function sourceStatus(
  available: boolean,
  affectedCount: number,
  warningLimit: number,
): ComplianceStatus {
  if (!available) return "pending";
  if (affectedCount === 0) return "compliant";
  return affectedCount <= warningLimit ? "warning" : "violation";
}

function sourceDetail(
  available: boolean,
  unavailableLabel: string,
  availableDetail: string,
): string {
  return available
    ? availableDetail
    : `No se pudo verificar ${unavailableLabel}. No se asume cumplimiento.`;
}

function affectedCount(
  available: boolean,
  count: number,
): number | undefined {
  return available && count > 0 ? count : undefined;
}

export function deriveComplianceChecks(
  snapshot: ComplianceSnapshot,
): ComplianceCheckResult {
  const jobs = snapshot.jobs.data.map(asRow);
  const disputes = snapshot.disputes.data.map(asRow);
  const members = snapshot.members.data.map(asRow);
  const ratingItems = snapshot.ratings.data.items.map(asRow);
  const travels = snapshot.travels.data.map(asRow);

  const jobsWithFunding = jobs.filter((job) => {
    const escrowStatus = String(job.escrowStatus ?? "").toLowerCase();
    return escrowStatus !== "" && escrowStatus !== "unfunded";
  });
  const jobsWithoutContract = jobsWithFunding.filter(
    (job) => !job.contractId && !job.hasContract,
  );
  const openDisputes = disputes.filter(
    (dispute) => String(dispute.status ?? "").toUpperCase() === "OPEN",
  );
  const workerMembers = members.filter(
    (member) => String(member.role ?? "").toLowerCase() === "worker",
  );
  const unverifiedWorkers = workerMembers.filter((member) => !member.verified);
  const lowRatingCount = ratingItems.filter(
    (rating) => Number(rating.score) < 3,
  ).length;
  const pendingTravelSettlements = travels.filter(
    (travel) => String(travel.status ?? "").toUpperCase() === "PENDING_SETTLEMENT",
  );

  const unavailableSources = [
    !snapshot.jobs.available ? "trabajos" : null,
    !snapshot.disputes.available ? "disputas" : null,
    !snapshot.members.available ? "miembros de organizaciones" : null,
    !snapshot.ratings.available ? "reseñas" : null,
    !snapshot.travels.available ? "viajes" : null,
  ].filter((source): source is string => source !== null);

  return {
    unavailableSources,
    items: [
      {
        id: "c1",
        title: "Contrato firmado antes de escrow",
        category: "legal",
        status: sourceStatus(snapshot.jobs.available, jobsWithoutContract.length, 2),
        detail: sourceDetail(
          snapshot.jobs.available,
          "los trabajos y contratos",
          jobsWithoutContract.length === 0
            ? "Todos los trabajos con fondeo consultados tienen contrato firmado previo."
            : `${jobsWithoutContract.length} trabajo${jobsWithoutContract.length > 1 ? "s" : ""} con fondeo sin contrato firmado.`,
        ),
        affectedCount: affectedCount(snapshot.jobs.available, jobsWithoutContract.length),
        actionLink: "/admin/finance",
      },
      {
        id: "c2",
        title: "Disputas de escrow abiertas",
        category: "escrow",
        status: sourceStatus(snapshot.disputes.available, openDisputes.length, 3),
        detail: sourceDetail(
          snapshot.disputes.available,
          "las disputas",
          openDisputes.length === 0
            ? "No hay disputas abiertas en la fuente consultada."
            : `${openDisputes.length} disputa${openDisputes.length > 1 ? "s" : ""} activa${openDisputes.length > 1 ? "s" : ""} bloqueando fondos.`,
        ),
        affectedCount: affectedCount(snapshot.disputes.available, openDisputes.length),
        actionLink: "/admin/disputes",
      },
      {
        id: "c3",
        title: "Trabajadores con identidad verificada",
        category: "license",
        status: sourceStatus(snapshot.members.available, unverifiedWorkers.length, 2),
        detail: sourceDetail(
          snapshot.members.available,
          "los miembros de las organizaciones",
          unverifiedWorkers.length === 0
            ? "Todos los trabajadores consultados tienen identidad verificada."
            : `${unverifiedWorkers.length} trabajador${unverifiedWorkers.length > 1 ? "es" : ""} sin verificación completa.`,
        ),
        affectedCount: affectedCount(snapshot.members.available, unverifiedWorkers.length),
        actionLink: "/admin/users",
      },
      {
        id: "c4",
        title: "Calidad de servicio (reseñas < 3★)",
        category: "insurance",
        status: sourceStatus(snapshot.ratings.available, lowRatingCount, 2),
        detail: sourceDetail(
          snapshot.ratings.available,
          "las reseñas",
          lowRatingCount === 0
            ? "No hay reseñas menores a 3 estrellas en la fuente consultada."
            : `${lowRatingCount} reseña${lowRatingCount > 1 ? "s" : ""} con puntuación menor a 3 estrellas.`,
        ),
        affectedCount: affectedCount(snapshot.ratings.available, lowRatingCount),
        actionLink: "/admin/users",
      },
      {
        id: "c5",
        title: "Liquidaciones de viaje pendientes",
        category: "escrow",
        status: sourceStatus(snapshot.travels.available, pendingTravelSettlements.length, 3),
        detail: sourceDetail(
          snapshot.travels.available,
          "los viajes",
          pendingTravelSettlements.length === 0
            ? "No hay liquidaciones pendientes en la fuente consultada."
            : `${pendingTravelSettlements.length} viaje${pendingTravelSettlements.length > 1 ? "s" : ""} con liquidación pendiente.`,
        ),
        affectedCount: affectedCount(snapshot.travels.available, pendingTravelSettlements.length),
        actionLink: pendingTravelSettlements.length > 0
          ? "/admin/travel?status=pending"
          : "/admin/travel",
      },
      {
        id: "c6",
        title: "Consentimiento de datos — revisión manual",
        category: "data",
        status: "pending",
        detail: "Esta consola no consulta un registro regulatorio de consentimientos. Verifica la política y su publicación en la fuente legal correspondiente.",
        actionLink: "/admin/settings",
      },
      {
        id: "c7",
        title: "Reporte fiscal — revisión manual",
        category: "legal",
        status: "pending",
        detail: "Esta consola no está integrada con una fuente fiscal. Confirma período, generación y envío en el sistema contable autorizado.",
        actionLink: "/admin/reports",
      },
    ],
  };
}
