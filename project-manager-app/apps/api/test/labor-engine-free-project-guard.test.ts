import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { REQUIRED_PERMISSIONS_KEY } from "../src/common/permissions.decorator.ts";
import { LaborEngineController } from "../dist/modules/labor-engine/labor-engine.controller.js";
import { LaborEngineService } from "../dist/modules/labor-engine/labor-engine.service.js";
import { LaborEngineRepository } from "../dist/modules/labor-engine/labor-engine.repository.js";

/**
 * S0 — guard de ownership y destino en mutaciones de FreeProject
 * (docs/specs/labor/free-project-mutation-guard.spec.md, casos N1–N14, P1, P2).
 *
 * Controller + service + repository reales sobre un Prisma en memoria que
 * evalúa los `where` de verdad (incluido `jobAssignmentWhere`). Datos 100%
 * ficticios. El fake no simula rollback: la atomicidad real se prueba en
 * labor-engine-free-project-integration.test.ts contra PostgreSQL.
 */

type Row = Record<string, unknown>;

function clone<T>(value: T): T {
  return structuredClone(value);
}

/** Subconjunto de la semántica de `where` de Prisma usada por el módulo. */
function matches(record: unknown, where: unknown): boolean {
  if (!where || typeof where !== "object") return true;
  const row = (record ?? {}) as Row;
  for (const [key, cond] of Object.entries(where as Row)) {
    if (key === "OR") {
      if (!(cond as unknown[]).some((clause) => matches(row, clause))) return false;
      continue;
    }
    const value = row[key];
    if (cond !== null && typeof cond === "object" && !(cond instanceof Date)) {
      const c = cond as Row;
      if ("some" in c) {
        if (!Array.isArray(value) || !value.some((item) => matches(item, c.some))) return false;
      } else if ("is" in c) {
        if (value == null || !matches(value, c.is)) return false;
      } else if ("in" in c) {
        if (!(c.in as unknown[]).includes(value)) return false;
      } else if ("not" in c) {
        if (value === c.not) return false;
      } else if (!matches(value, c)) {
        return false;
      }
      continue;
    }
    if (value !== cond) return false;
  }
  return true;
}

type Call = { model: string; op: string; via: "root" | "tx"; args: unknown };

function createDb() {
  const freeProjects: Row[] = [
    {
      id: "fp-active", tenantId: "tnt-a", createdBy: "worker-a", name: "Obra Ficticia",
      color: "#3B82F6", location: "Calle Ficticia 1", latitude: 19.1, longitude: -99.1,
      locationSource: "manual", description: "Notas privadas", status: "active",
      convertedJobId: null, createdAt: new Date("2026-10-01T00:00:00Z"), updatedAt: new Date("2026-10-01T00:00:00Z"),
    },
    {
      id: "fp-archived", tenantId: "tnt-a", createdBy: "worker-a", name: "Archivado", color: "#000000",
      location: null, latitude: null, longitude: null, locationSource: null, description: null,
      status: "archived", convertedJobId: null,
      createdAt: new Date("2026-09-01T00:00:00Z"), updatedAt: new Date("2026-09-02T00:00:00Z"),
    },
    {
      id: "fp-converted", tenantId: "tnt-a", createdBy: "worker-a", name: "Convertido", color: "#000000",
      location: null, latitude: null, longitude: null, locationSource: null, description: null,
      status: "converted", convertedJobId: "job-assigned",
      createdAt: new Date("2026-09-01T00:00:00Z"), updatedAt: new Date("2026-09-03T00:00:00Z"),
    },
  ];
  const acceptedBidByOwner = [{ professionalUserId: "worker-a", status: "ACCEPTED" }];
  const jobs: Row[] = [
    { id: "job-assigned", tenantId: "tnt-a", deletedAt: null, bids: clone(acceptedBidByOwner), reservations: [], contract: null, project: null },
    { id: "job-assigned-2", tenantId: "tnt-a", deletedAt: null, bids: clone(acceptedBidByOwner), reservations: [], contract: null, project: null },
    {
      id: "job-org-only", tenantId: "tnt-a", deletedAt: null, bids: [],
      reservations: [{ professionalId: "someone-else", professionalOrgId: "org-a", status: "ACTIVE" }],
      contract: null, project: null,
    },
    { id: "job-unassigned", tenantId: "tnt-a", deletedAt: null, bids: [], reservations: [], contract: null, project: null },
    { id: "job-deleted", tenantId: "tnt-a", deletedAt: new Date("2026-10-10T00:00:00Z"), bids: clone(acceptedBidByOwner), reservations: [], contract: null, project: null },
    { id: "job-other-tenant", tenantId: "tnt-d", deletedAt: null, bids: clone(acceptedBidByOwner), reservations: [], contract: null, project: null },
  ];
  // Horas registradas: S0 nunca debe tocarlas.
  const timeEntries: Row[] = [
    { id: "te-1", tenantId: "tnt-a", createdBy: "worker-a", freeProjectId: "fp-active", durationMinutes: 510, status: "completed" },
  ];
  const auditLogs: Row[] = [];
  const calls: Call[] = [];
  const options = { failAudit: false };

  function client(via: "root" | "tx") {
    const record = (model: string, op: string, args: unknown) => calls.push({ model, op, via, args: clone(args) });
    return {
      freeProject: {
        async findFirst(args: { where: Row }) {
          record("freeProject", "findFirst", args);
          const row = freeProjects.find((r) => matches(r, args.where));
          return row ? clone(row) : null;
        },
        async findMany(args: { where: Row }) {
          record("freeProject", "findMany", args);
          return freeProjects.filter((r) => matches(r, args.where)).map(clone);
        },
        async update(args: { where: Row; data: Row }) {
          record("freeProject", "update", args);
          const row = freeProjects.find((r) => r.id === args.where.id);
          if (!row) throw new Error("Record to update not found.");
          Object.assign(row, args.data);
          return clone(row);
        },
        async updateMany(args: { where: Row; data: Row }) {
          record("freeProject", "updateMany", args);
          const rows = freeProjects.filter((r) => matches(r, args.where));
          for (const row of rows) Object.assign(row, args.data);
          return { count: rows.length };
        },
      },
      job: {
        async findFirst(args: { where: Row }) {
          record("job", "findFirst", args);
          const row = jobs.find((r) => matches(r, args.where));
          return row ? { id: row.id } : null;
        },
      },
      timeEntry: {
        async findFirst(args: { where: Row }) {
          record("timeEntry", "findFirst", args);
          return null;
        },
      },
      auditLog: {
        async create(args: { data: Row }) {
          record("auditLog", "create", args);
          if (options.failAudit) throw new Error("audit store unavailable");
          auditLogs.push(clone(args.data));
          return args.data;
        },
      },
    };
  }

  const root = {
    ...client("root"),
    async $transaction<T>(fn: (tx: ReturnType<typeof client>) => Promise<T>): Promise<T> {
      return fn(client("tx"));
    },
  };

  const ensureCalls: Row[] = [];
  const actorContext = {
    async ensureActorContext(input: Row) {
      ensureCalls.push(clone(input));
    },
  };

  return { root, actorContext, freeProjects, jobs, timeEntries, auditLogs, calls, options, ensureCalls };
}

function setup() {
  const db = createDb();
  const repository = new LaborEngineRepository(db.root as never, db.actorContext as never);
  const service = new LaborEngineService(repository as never, {} as never);
  const controller = new LaborEngineController(service as never, {} as never);
  return { db, service, controller };
}

const ACTORS = {
  owner: { tenantId: "tnt-a", orgId: "org-a", userId: "worker-a", roles: ["WORKER"] },
  peer: { tenantId: "tnt-a", orgId: "org-a", userId: "worker-b", roles: ["WORKER"] },
  otherOrg: { tenantId: "tnt-a", orgId: "org-c", userId: "worker-c", roles: ["PRO"] },
  otherTenant: { tenantId: "tnt-d", orgId: "org-d", userId: "worker-d", roles: ["PRO"] },
} as const;

function req(actor: (typeof ACTORS)[keyof typeof ACTORS]) {
  return { headers: { "x-request-id": "req-s0-test" }, authContext: { ...actor } };
}

function httpStatus(expected: number) {
  return (error: unknown) => {
    const status = (error as { getStatus?: () => number }).getStatus?.();
    assert.equal(status, expected, `expected HTTP ${expected}, got ${String(status)}: ${String(error)}`);
    return true;
  };
}

function snapshot(db: ReturnType<typeof createDb>, id: string) {
  return clone(db.freeProjects.find((r) => r.id === id));
}

function writes(db: ReturnType<typeof createDb>) {
  return db.calls.filter((c) => c.model === "freeProject" && (c.op === "update" || c.op === "updateMany")).length;
}

// ── N1–N4: el FreeProject ajeno o inexistente responde 404 y no cambia ─────

for (const [label, actor] of [
  ["N1 otro usuario, mismo tenant y misma org", ACTORS.peer],
  ["N2 usuario de otra org, mismo tenant", ACTORS.otherOrg],
  ["N3 usuario de otro tenant", ACTORS.otherTenant],
] as const) {
  void test(`${label}: PATCH, DELETE y convert responden 404 sin cambiar el proyecto`, async () => {
    const { db, controller } = setup();
    const before = snapshot(db, "fp-active");

    await assert.rejects(
      controller.updateFreeProject(req(actor) as never, "fp-active", { name: "Renombrado por otro" }),
      httpStatus(404),
    );
    await assert.rejects(controller.archiveFreeProject(req(actor) as never, "fp-active"), httpStatus(404));
    await assert.rejects(
      controller.convertFreeProject(req(actor) as never, "fp-active", { jobId: "job-assigned" }),
      httpStatus(404),
    );

    assert.deepEqual(snapshot(db, "fp-active"), before);
    assert.equal(writes(db), 0);
    assert.equal(db.auditLogs.length, 0);
  });
}

void test("N1: un PATCH vacío de otro usuario no devuelve los datos del proyecto (lectura vía escritura)", async () => {
  const { db, controller } = setup();
  let leaked: unknown;
  await assert.rejects(
    (async () => {
      leaked = await controller.updateFreeProject(req(ACTORS.peer) as never, "fp-active", {});
    })(),
    httpStatus(404),
  );
  assert.equal(leaked, undefined);
  assert.equal(writes(db), 0);
});

void test("N4: id inexistente responde 404 en las tres rutas", async () => {
  const { db, controller } = setup();
  await assert.rejects(controller.updateFreeProject(req(ACTORS.owner) as never, "fp-missing", { name: "x" }), httpStatus(404));
  await assert.rejects(controller.archiveFreeProject(req(ACTORS.owner) as never, "fp-missing"), httpStatus(404));
  await assert.rejects(
    controller.convertFreeProject(req(ACTORS.owner) as never, "fp-missing", { jobId: "job-assigned" }),
    httpStatus(404),
  );
  assert.equal(writes(db), 0);
});

// ── N5–N8: Job destino inválido → 403 con el mismo mensaje, sin cambios ────

void test("N5–N8: Job inexistente, eliminado, de otro tenant o no asignado → 403 genérico y sin escritura", async () => {
  const { db, controller } = setup();
  const before = snapshot(db, "fp-active");
  const messages: string[] = [];

  for (const jobId of ["job-missing", "job-deleted", "job-other-tenant", "job-unassigned"]) {
    await assert.rejects(
      controller.convertFreeProject(req(ACTORS.owner) as never, "fp-active", { jobId }),
      (error: unknown) => {
        httpStatus(403)(error);
        messages.push((error as Error).message);
        return true;
      },
    );
  }

  assert.equal(new Set(messages).size, 1, `mensajes distintos revelan el motivo: ${messages.join(" | ")}`);
  assert.deepEqual(snapshot(db, "fp-active"), before);
  assert.equal(writes(db), 0);
  assert.equal(db.auditLogs.length, 0);
});

void test("N5–N8: la validación del Job usa tenant/org/usuario de la sesión, no del cuerpo", async () => {
  const { db, controller } = setup();
  await assert.rejects(
    controller.convertFreeProject(req(ACTORS.owner) as never, "fp-active", {
      jobId: "job-unassigned", tenantId: "tnt-d", orgId: "org-x", userId: "worker-z",
    }),
    httpStatus(403),
  );
  const jobQuery = db.calls.find((c) => c.model === "job" && c.op === "findFirst");
  assert.ok(jobQuery, "debe consultar el Job destino");
  const where = (jobQuery.args as { where: Row }).where;
  assert.equal(where.tenantId, "tnt-a");
  assert.equal(where.deletedAt, null);
  assert.match(JSON.stringify(where.OR), /worker-a/);
  assert.match(JSON.stringify(where.OR), /org-a/);
  assert.doesNotMatch(JSON.stringify(where), /worker-z|org-x|tnt-d/);
});

// ── D8: asignación sólo a nivel org se acepta en S0 ─────────────────────────

void test("D8: un Job vinculado sólo a la org del dueño se acepta en S0 (paridad con selector y startTimer)", async () => {
  const { db, controller } = setup();
  const result = await controller.convertFreeProject(req(ACTORS.owner) as never, "fp-active", { jobId: "job-org-only" });
  assert.equal((result.data as Row).status, "converted");
  assert.equal((result.data as Row).convertedJobId, "job-org-only");
  assert.equal(db.auditLogs.length, 1);
});

// ── N9/N10: conflictos de estado ────────────────────────────────────────────

void test("N9: un proyecto ya convertido no se reconvierte a otro Job (409) y conserva su referencia", async () => {
  const { db, controller } = setup();
  await assert.rejects(
    controller.convertFreeProject(req(ACTORS.owner) as never, "fp-converted", { jobId: "job-assigned-2" }),
    httpStatus(409),
  );
  assert.equal(snapshot(db, "fp-converted")?.convertedJobId, "job-assigned");
  assert.equal(writes(db), 0);
});

void test("N10: un proyecto archivado no se convierte (409)", async () => {
  const { db, controller } = setup();
  await assert.rejects(
    controller.convertFreeProject(req(ACTORS.owner) as never, "fp-archived", { jobId: "job-assigned" }),
    httpStatus(409),
  );
  assert.equal(snapshot(db, "fp-archived")?.status, "archived");
  assert.equal(snapshot(db, "fp-archived")?.convertedJobId, null);
  assert.equal(writes(db), 0);
});

void test("N11: jobId ausente o no string → 400", async () => {
  const { controller } = setup();
  await assert.rejects(controller.convertFreeProject(req(ACTORS.owner) as never, "fp-active", {}), httpStatus(400));
  await assert.rejects(controller.convertFreeProject(req(ACTORS.owner) as never, "fp-active", { jobId: 42 }), httpStatus(400));
});

// ── N12: PATCH no cambia status ─────────────────────────────────────────────

for (const status of ["active", "archived", "converted", "otro-valor"]) {
  void test(`N12: PATCH con status "${status}" responde 400 y no cambia nada`, async () => {
    const { db, controller } = setup();
    const before = snapshot(db, "fp-archived");
    await assert.rejects(
      controller.updateFreeProject(req(ACTORS.owner) as never, "fp-archived", { status, name: "x" }),
      httpStatus(400),
    );
    assert.deepEqual(snapshot(db, "fp-archived"), before);
    assert.equal(writes(db), 0);
  });
}

// ── N13: RBAC declarado en las tres rutas ───────────────────────────────────

void test("N13: PATCH, DELETE y convert exigen exactamente field-ops:write", () => {
  for (const method of ["updateFreeProject", "archiveFreeProject", "convertFreeProject"]) {
    const meta = Reflect.getMetadata(
      REQUIRED_PERMISSIONS_KEY,
      (LaborEngineController.prototype as unknown as Record<string, unknown>)[method] as object,
    );
    assert.deepEqual(meta, ["field-ops:write"], method);
  }
});

// ── N14: conversiones concurrentes ──────────────────────────────────────────

void test("N14: dos conversiones concurrentes a Jobs distintos → una 200 y otra 409", async () => {
  const { db, controller } = setup();
  const results = await Promise.allSettled([
    controller.convertFreeProject(req(ACTORS.owner) as never, "fp-active", { jobId: "job-assigned" }),
    controller.convertFreeProject(req(ACTORS.owner) as never, "fp-active", { jobId: "job-assigned-2" }),
  ]);
  const fulfilled = results.filter((r) => r.status === "fulfilled");
  const rejected = results.filter((r) => r.status === "rejected");
  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  httpStatus(409)((rejected[0] as PromiseRejectedResult).reason);
  const winner = ((fulfilled[0] as PromiseFulfilledResult<{ data: Row }>).value.data).convertedJobId;
  assert.equal(snapshot(db, "fp-active")?.convertedJobId, winner);
  assert.equal(db.auditLogs.length, 1);
});

// ── P1/P2: camino legítimo, idempotencia, auditoría y conservación ─────────

void test("P1: el dueño convierte a un Job asignado; se audita sin PII y no se tocan horas ni Job", async () => {
  const { db, controller } = setup();
  const jobBefore = clone(db.jobs.find((j) => j.id === "job-assigned"));
  const hoursBefore = clone(db.timeEntries);

  const result = await controller.convertFreeProject(req(ACTORS.owner) as never, "fp-active", { jobId: "job-assigned" });

  assert.equal((result.data as Row).status, "converted");
  assert.equal((result.data as Row).convertedJobId, "job-assigned");
  assert.deepEqual(db.jobs.find((j) => j.id === "job-assigned"), jobBefore);
  assert.deepEqual(db.timeEntries, hoursBefore);

  assert.equal(db.auditLogs.length, 1);
  const audit = db.auditLogs[0]!;
  assert.equal(audit.action, "free_project.converted");
  assert.equal(audit.entityType, "FreeProject");
  assert.equal(audit.entityId, "fp-active");
  assert.equal(audit.tenantId, "tnt-a");
  assert.equal(audit.actorUserId, "worker-a");
  assert.deepEqual(audit.beforeJson, { status: "active" });
  assert.equal((audit.afterJson as Row).status, "converted");
  assert.equal((audit.afterJson as Row).convertedJobId, "job-assigned");
  assert.equal((audit.afterJson as Row).requestId, "req-s0-test");
  assert.doesNotMatch(JSON.stringify(audit), /Obra Ficticia|Calle Ficticia|Notas privadas|19\.1|-99\.1/);
});

void test("P1: la escritura condicional y el audit usan el mismo cliente de transacción", async () => {
  const { db, controller } = setup();
  await controller.convertFreeProject(req(ACTORS.owner) as never, "fp-active", { jobId: "job-assigned" });

  const write = db.calls.find((c) => c.model === "freeProject" && c.op === "updateMany");
  const audit = db.calls.find((c) => c.model === "auditLog" && c.op === "create");
  assert.equal(write?.via, "tx");
  assert.equal(audit?.via, "tx");
  const where = (write?.args as { where: Row }).where;
  assert.deepEqual(where, { id: "fp-active", tenantId: "tnt-a", createdBy: "worker-a", status: "active" });
  assert.deepEqual(db.ensureCalls, [{ tenantId: "tnt-a", orgId: "org-a", userId: "worker-a" }]);
});

void test("P1: si el insert de audit falla, la conversión responde error (no se traga el fallo)", async () => {
  const { db, controller } = setup();
  db.options.failAudit = true;
  await assert.rejects(
    controller.convertFreeProject(req(ACTORS.owner) as never, "fp-active", { jobId: "job-assigned" }),
    /audit store unavailable/,
  );
});

void test("P2: repetir la conversión al mismo Job es idempotente (200, sin escritura ni audit nuevo)", async () => {
  const { db, controller } = setup();
  await controller.convertFreeProject(req(ACTORS.owner) as never, "fp-active", { jobId: "job-assigned" });
  const writesAfterFirst = writes(db);

  const again = await controller.convertFreeProject(req(ACTORS.owner) as never, "fp-active", { jobId: "job-assigned" });

  assert.equal((again.data as Row).convertedJobId, "job-assigned");
  assert.equal(writes(db), writesAfterFirst);
  assert.equal(db.auditLogs.length, 1);
});

void test("P2: el dueño edita campos descriptivos; el resto del registro se conserva", async () => {
  const { db, controller } = setup();
  const result = await controller.updateFreeProject(req(ACTORS.owner) as never, "fp-active", {
    name: "Obra renombrada",
    color: "#10B981",
  });
  assert.equal((result.data as Row).name, "Obra renombrada");
  assert.equal((result.data as Row).color, "#10B981");
  assert.equal((result.data as Row).status, "active");
  assert.equal((result.data as Row).location, "Calle Ficticia 1");
  assert.equal(db.auditLogs.length, 0);
});

void test("P2: archivar audita el estado previo; repetirlo no reescribe ni audita; horas intactas", async () => {
  const { db, controller } = setup();
  const hoursBefore = clone(db.timeEntries);

  const archived = await controller.archiveFreeProject(req(ACTORS.owner) as never, "fp-active");
  assert.equal((archived.data as Row).status, "archived");
  assert.equal(db.auditLogs.length, 1);
  assert.equal(db.auditLogs[0]!.action, "free_project.archived");
  assert.deepEqual(db.auditLogs[0]!.beforeJson, { status: "active" });
  const writesAfterFirst = writes(db);

  const again = await controller.archiveFreeProject(req(ACTORS.owner) as never, "fp-active");
  assert.equal((again.data as Row).status, "archived");
  assert.equal(writes(db), writesAfterFirst);
  assert.equal(db.auditLogs.length, 1);
  assert.deepEqual(db.timeEntries, hoursBefore);
});

void test("P2: archivar un proyecto convertido conserva su convertedJobId histórico", async () => {
  const { db, controller } = setup();
  const result = await controller.archiveFreeProject(req(ACTORS.owner) as never, "fp-converted");
  assert.equal((result.data as Row).status, "archived");
  assert.equal((result.data as Row).convertedJobId, "job-assigned");
  assert.deepEqual(db.auditLogs[0]!.beforeJson, { status: "converted" });
});

// ── convertedJobId nunca concede permisos ───────────────────────────────────

void test("convertedJobId no concede permisos: sin asignación vigente, startTimer sobre ese Job sigue en 403", async () => {
  const { db, service, controller } = setup();
  await controller.convertFreeProject(req(ACTORS.owner) as never, "fp-active", { jobId: "job-assigned" });
  // La asignación se retira después de convertir.
  db.jobs.find((j) => j.id === "job-assigned")!.bids = [];

  await assert.rejects(
    service.startTimer({ tenantId: "tnt-a", orgId: "org-a", createdBy: "worker-a", purpose: "job_linked", jobId: "job-assigned" }),
    httpStatus(403),
  );
  assert.equal(snapshot(db, "fp-active")?.convertedJobId, "job-assigned");
});
