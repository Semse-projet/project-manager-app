/**
 * C57 — logica pura de la deduplicacion de mantenimiento (sin acceso a DB).
 *
 * Reemplaza al `runDedup()` que corria en cada arranque borrando "el id mayor".
 * Principios:
 *  - el id no es un criterio de negocio: una fila canonica se elige por
 *    dependientes verificados y, si no hay, por antiguedad real (createdAt);
 *  - si la eleccion es ambigua o hay hijos colgando de mas de una fila, el
 *    grupo se BLOQUEA y requiere fusion manual: nunca se borra a ciegas;
 *  - toda relacion que apunte a una fila a borrar debe estar verificada
 *    (FK de una sola columna con conteo exacto); una FK compuesta bloquea.
 */

export const DEFAULT_MAX_ROWS = 50;
export const APPLY_CONFIRM_ENV = "DEDUP_APPLY_CONFIRM";
export const APPLY_CONFIRM_VALUE = "I_HAVE_A_VERIFIED_BACKUP";

/** Grupos que coinciden con los @@unique/@unique reales del schema. */
export const DEDUP_TARGETS = [
  { name: "BuildOpsProject", table: "BuildOpsProject", keyColumns: ["jobId"], requireNonNull: ["jobId"] },
  { name: "BuildOpsTask", table: "BuildOpsTask", keyColumns: ["projectId", "templateKey"], requireNonNull: ["projectId", "templateKey"] },
  {
    name: "Milestone",
    table: "Milestone",
    keyColumns: ["projectId", "promotedFromBuildOpsProjectId", "sequence"],
    requireNonNull: ["promotedFromBuildOpsProjectId"], // Postgres trata NULL como distinto
    extraWhere: `"deletedAt" IS NULL`,
  },
  { name: "Project", table: "Project", keyColumns: ["promotedFromBuildOpsProjectId"], requireNonNull: ["promotedFromBuildOpsProjectId"] },
  {
    name: "JobTask",
    table: "JobTask",
    keyColumns: ["jobId", "promotedFromBuildOpsTaskId"],
    requireNonNull: ["promotedFromBuildOpsTaskId"],
  },
];

/**
 * @param {{id:string, createdAt?: Date|string|null, refCount:number, unverifiableRefs?:boolean}[]} rows
 * @returns {{status:"ok"|"blocked", canonicalId?:string, deleteIds:string[], reason?:string}}
 */
export function classifyGroup(rows) {
  if (rows.length < 2) return { status: "ok", canonicalId: rows[0]?.id, deleteIds: [] };

  if (rows.some((r) => r.unverifiableRefs)) {
    return { status: "blocked", deleteIds: [], reason: "relaciones no verificables (FK compuesta): fusion manual" };
  }

  const withRefs = rows.filter((r) => r.refCount > 0);
  if (withRefs.length > 1) {
    return {
      status: "blocked",
      deleteIds: [],
      reason: `hay hijos colgando de ${withRefs.length} filas distintas: requiere fusion manual`,
    };
  }

  let canonical;
  if (withRefs.length === 1) {
    canonical = withRefs[0];
  } else {
    const dated = rows.filter((r) => r.createdAt != null);
    if (dated.length !== rows.length) {
      return { status: "blocked", deleteIds: [], reason: "sin dependientes y sin createdAt: eleccion ambigua" };
    }
    const sorted = [...dated].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    if (new Date(sorted[0].createdAt).getTime() === new Date(sorted[1].createdAt).getTime()) {
      return { status: "blocked", deleteIds: [], reason: "empate de createdAt entre candidatas: eleccion ambigua" };
    }
    canonical = sorted[0];
  }

  return {
    status: "ok",
    canonicalId: canonical.id,
    deleteIds: rows.filter((r) => r.id !== canonical.id).map((r) => r.id),
  };
}

/** Valida los argumentos de --apply. Devuelve lista de errores (vacia = ok). */
export function validateApplyOptions({ apply, backupEvidence, maxRows }, env = process.env) {
  if (!apply) return [];
  const errors = [];
  if (!backupEvidence || String(backupEvidence).trim().length < 8) {
    errors.push("--apply requiere --backup-evidence=<referencia del backup/restore verificado>");
  }
  if (env[APPLY_CONFIRM_ENV] !== APPLY_CONFIRM_VALUE) {
    errors.push(`--apply requiere ${APPLY_CONFIRM_ENV}=${APPLY_CONFIRM_VALUE}`);
  }
  if (!Number.isInteger(maxRows) || maxRows < 1) {
    errors.push("--max-rows debe ser un entero positivo");
  }
  return errors;
}

export function parseArgs(argv) {
  const out = { apply: false, backupEvidence: null, maxRows: DEFAULT_MAX_ROWS, report: null, only: null };
  for (const a of argv) {
    if (a === "--apply") out.apply = true;
    else if (a.startsWith("--backup-evidence=")) out.backupEvidence = a.slice("--backup-evidence=".length);
    else if (a.startsWith("--max-rows=")) out.maxRows = Number(a.slice("--max-rows=".length));
    else if (a.startsWith("--report=")) out.report = a.slice("--report=".length);
    else if (a.startsWith("--only=")) out.only = a.slice("--only=".length);
    else if (a === "--dry-run") out.apply = false;
    else throw new Error(`argumento desconocido: ${a}`);
  }
  return out;
}
