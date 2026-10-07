import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { ChatEvidenceAnalysisService, CHAT_EVIDENCE_DAILY_LIMIT } from "../dist/modules/vision/chat-evidence-analysis.service.js";
import { ChatEvidenceAnalysisController } from "../dist/modules/vision/chat-evidence-analysis.controller.js";

// prometeo.chat-evidence · Wave 3 (CE-030..CE-032). Endpoint fino de análisis: flag, pertenencia, tope diario por intentos
// ADMITIDOS (concurrente-seguro), auditoría previa con fallo cerrado y registro del resultado.

const NOW = new Date("2026-10-07T15:00:00.000Z");
const actor = { tenantId: "t1", orgId: "orgA", userId: "u1", roles: ["CLIENT"] };

type Row = { id: string; tenantId: string; actorUserId: string; entityType: string; entityId: string; action: string; afterJson: any; occurredAt: Date };

function setup(opts: {
  evidence?: { id: string; kind: string; bucketKey: string } | null;
  existing?: any;
  seed?: Row[];
  failAttemptWrite?: boolean;
  failResultWrite?: boolean;
  analysis?: () => Promise<any>;
  access?: (a: unknown, ids: string[]) => Promise<void>;
} = {}) {
  const rows: Row[] = [...(opts.seed ?? [])];
  const state = { locks: new Map<string, Promise<void>>(), lockStatements: [] as string[], analyzeCalls: 0, accessCalls: 0, order: [] as string[] };
  const mkTx = (release: Array<() => void>) => ({
    $executeRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join("?");
      state.lockStatements.push(sql);
      const key = String(values[0]);
      // Candado de asesoría simulado: otra transacción con la misma clave espera a que ésta termine.
      while (state.locks.has(key)) await state.locks.get(key);
      let done!: () => void;
      state.locks.set(key, new Promise<void>((resolve) => (done = resolve)));
      release.push(() => { state.locks.delete(key); done(); });
    },
    auditLog: {
      count: async ({ where }: any) => {
        const n = rows.filter((r) => r.tenantId === where.tenantId && r.actorUserId === where.actorUserId && r.action === where.action && r.occurredAt >= where.occurredAt.gte).length;
        await new Promise((resolve) => setImmediate(resolve)); // abre la ventana de carrera si faltara el candado
        return n;
      },
      create: async ({ data }: any) => {
        if (opts.failAttemptWrite && data.action.endsWith("analysis_requested")) throw new Error("audit down");
        state.order.push(data.action);
        rows.push(data);
        return data;
      },
    },
  });
  const prisma = {
    evidence: { findFirst: async () => (opts.evidence === undefined ? { id: "ev1", kind: "PHOTO", bucketKey: "t1/ev1.jpg" } : opts.evidence) },
    visionAnalysis: { findUnique: async () => opts.existing ?? null },
    auditLog: {
      create: async ({ data }: any) => {
        if (opts.failResultWrite) throw new Error("audit down");
        state.order.push(data.action);
        rows.push(data);
        return data;
      },
    },
    $transaction: async (fn: (tx: any) => Promise<unknown>) => {
      const release: Array<() => void> = [];
      try { return await fn(mkTx(release)); } finally { release.forEach((r) => r()); }
    },
  };
  const vision = {
    analyzeByEvidenceId: async () => {
      state.analyzeCalls += 1;
      state.order.push("analyze");
      return opts.analysis ? opts.analysis() : { evidenceId: "ev1", status: "completed", qualityScore: 80, riskLevel: "low", riskReasons: ["Sombra https://evil.example/x"], requiresHumanReview: false, recommendedAction: "review", canAutoApprove: true, rawResult: { secret: "RAW" } };
    },
  };
  const access = { assertEvidence: async (a: unknown, ids: string[]) => { state.accessCalls += 1; await opts.access?.(a, ids); } };
  const actorCtx = { ensureActorContext: async () => {} };
  const service = new ChatEvidenceAnalysisService(prisma as never, vision as never, access as never, actorCtx as never);
  return { service, rows, state };
}

const run = (service: ChatEvidenceAnalysisService, over: Record<string, unknown> = {}) =>
  service.analyze({ actor, evidenceId: "ev1", requestId: "req-1", mode: "live", now: NOW, ...over } as never);
const status = async (p: Promise<unknown>) => { try { await p; return 200; } catch (e: any) { return e.getStatus?.() ?? 500; } };

// ── CE-030 ──────────────────────────────────────────────────────────────────

test("CE-030: modo off ⇒ rechazo y no se analiza ni se audita", async () => {
  const { service, state, rows } = setup();
  assert.equal(await status(run(service, { mode: "off" })), 404);
  assert.equal(state.analyzeCalls, 0);
  assert.equal(rows.length, 0);
});

test("CE-030: otro tenant/inexistente ⇒ 404 y otra organización ⇒ 403 (de la política de acceso), sin analizar ni contar", async () => {
  for (const code of [404, 403]) {
    const { service, state, rows } = setup({ access: async () => { const e: any = new Error("x"); e.getStatus = () => code; throw e; } });
    assert.equal(await status(run(service)), code);
    assert.equal(state.analyzeCalls, 0);
    assert.equal(rows.length, 0, "ni siquiera se cuenta como intento admitido");
  }
});

test("CE-030: sin imagen real (video, sin bucketKey o inexistente) ⇒ rechazo, sin auditar ni analizar", async () => {
  for (const evidence of [{ id: "ev1", kind: "VIDEO", bucketKey: "k" }, { id: "ev1", kind: "PHOTO", bucketKey: "" }, null]) {
    const { service, state, rows } = setup({ evidence });
    const code = await status(run(service));
    assert.ok(code === 400 || code === 404, String(code));
    assert.equal(state.analyzeCalls, 0);
    assert.equal(rows.length, 0);
  }
});

test("CE-030: análisis completado existente ⇒ se devuelve sin repetir y sin consumir cupo", async () => {
  const { service, state, rows } = setup({ existing: { evidenceId: "ev1", status: "completed", qualityScore: 91, riskLevel: "low", riskReasons: [], requiresHumanReview: false, recommendedAction: null, rawResult: { x: 1 }, canAutoApprove: true } });
  const out: any = await run(service);
  assert.equal(state.analyzeCalls, 0);
  assert.equal(rows.length, 0);
  assert.equal(out.analysisStatus, "completed");
  assert.equal(out.qualityScore, 91);
});

test("CE-030: la respuesta es un resumen saneado: sin rawResult, canAutoApprove ni enlaces, con etiqueta fija", async () => {
  const { service } = setup();
  const out: any = await run(service);
  const json = JSON.stringify(out);
  for (const leak of ["rawResult", "RAW", "canAutoApprove", "evil.example", "http"]) assert.equal(json.includes(leak), false, leak);
  assert.equal(out.analysisStatus, "completed");
  assert.match(out.disclaimer, /opinión asistida, no es una aprobación/i);
});

test("CE-030: la auditoría se escribe ANTES de analizar, con correlación al chat, y el resultado se registra enlazado", async () => {
  const { service, rows, state } = setup();
  await run(service, { chatRequestId: "chat-req-9" });
  assert.deepEqual(state.order, ["prometeo.chat_evidence.analysis_requested", "analyze", "prometeo.chat_evidence.analysis_succeeded"]);
  const [attempt, result] = rows;
  assert.equal(attempt!.tenantId, "t1");
  assert.equal(attempt!.actorUserId, "u1");
  assert.equal(attempt!.entityId, "ev1");
  assert.equal(attempt!.afterJson.requestId, "req-1");
  assert.equal(attempt!.afterJson.chatRequestId, "chat-req-9");
  assert.equal(attempt!.afterJson.origin, "chat");
  assert.equal(result!.afterJson.attemptId, attempt!.id, "el resultado se enlaza con el intento");
});

test("CE-030: si el análisis falla se registra FAILED (con el intento ya consumido) y la llamada responde error", async () => {
  const { service, rows } = setup({ analysis: async () => { throw new Error("vision down"); } });
  assert.ok((await status(run(service))) >= 500);
  assert.deepEqual(rows.map((r) => r.action), ["prometeo.chat_evidence.analysis_requested", "prometeo.chat_evidence.analysis_failed"]);
});

test("CE-030: un análisis que vuelve en estado failed se registra como FAILED pero se devuelve degradado", async () => {
  const { service, rows } = setup({ analysis: async () => ({ evidenceId: "ev1", status: "failed", qualityScore: null, riskLevel: null, riskReasons: null, requiresHumanReview: true, recommendedAction: null }) });
  const out: any = await run(service);
  assert.equal(out.analysisStatus, "failed");
  assert.equal(rows.at(-1)!.action, "prometeo.chat_evidence.analysis_failed");
});

test("CE-030: FALLO CERRADO — si la auditoría previa no se puede escribir, no se analiza", async () => {
  const { service, state } = setup({ failAttemptWrite: true });
  assert.equal(await status(run(service)), 503);
  assert.equal(state.analyzeCalls, 0);
});

test("CE-030: si falla escribir el resultado, el usuario aún recibe el análisis ya ejecutado (el intento ya quedó auditado)", async () => {
  const { service, state } = setup({ failResultWrite: true });
  const out: any = await run(service);
  assert.equal(out.analysisStatus, "completed");
  assert.equal(state.analyzeCalls, 1);
});

// ── CE-032 tope diario ──────────────────────────────────────────────────────

const attempt = (i: number, over: Partial<Row> = {}): Row => ({
  id: `a${i}`, tenantId: "t1", actorUserId: "u1", entityType: "ChatEvidenceAnalysis", entityId: `x${i}`,
  action: "prometeo.chat_evidence.analysis_requested", afterJson: {}, occurredAt: new Date("2026-10-07T01:00:00.000Z"), ...over,
});

test("CE-032: el 21.º intento del día ⇒ 429 y no analiza; el límite es 20", async () => {
  assert.equal(CHAT_EVIDENCE_DAILY_LIMIT, 20);
  const { service, state, rows } = setup({ seed: Array.from({ length: 19 }, (_, i) => attempt(i)) });
  await run(service); // 20.º: admitido
  assert.equal(state.analyzeCalls, 1);
  assert.equal(await status(run(service)), 429); // 21.º
  assert.equal(state.analyzeCalls, 1);
  assert.equal(rows.filter((r) => r.action.endsWith("analysis_requested")).length, 20, "el rechazado no escribe intento");
});

test("CE-032: cuentan intentos ADMITIDOS aunque hayan fallado", async () => {
  const seed = Array.from({ length: 20 }, (_, i) => attempt(i, { afterJson: { outcome: "failed" } }));
  const { service } = setup({ seed });
  assert.equal(await status(run(service)), 429);
});

test("CE-032: el conteo es por usuario, tenant, acción y día UTC (ayer, otro usuario, otro tenant u otra acción no cuentan)", async () => {
  const seed = [
    ...Array.from({ length: 20 }, (_, i) => attempt(i, { occurredAt: new Date("2026-10-06T23:59:59.999Z") })),
    ...Array.from({ length: 20 }, (_, i) => attempt(100 + i, { actorUserId: "other" })),
    ...Array.from({ length: 20 }, (_, i) => attempt(200 + i, { tenantId: "t2" })),
    ...Array.from({ length: 20 }, (_, i) => attempt(300 + i, { action: "prometeo.chat_evidence.analysis_succeeded" })),
  ];
  const { service, state } = setup({ seed });
  await run(service);
  assert.equal(state.analyzeCalls, 1);
});

test("CE-032: solicitudes CONCURRENTES no superan el límite (candado de asesoría por usuario y día)", async () => {
  const { service, state, rows } = setup({ seed: Array.from({ length: 15 }, (_, i) => attempt(i)) });
  const codes = await Promise.all(Array.from({ length: 12 }, () => status(run(service))));
  assert.equal(codes.filter((c) => c === 200).length, 5, "solo caben 5 más");
  assert.equal(codes.filter((c) => c === 429).length, 7);
  assert.equal(rows.filter((r) => r.action.endsWith("analysis_requested")).length, 20);
  assert.equal(state.analyzeCalls, 5);
  assert.ok(state.lockStatements.every((s) => /pg_advisory_xact_lock/.test(s)), "usa el candado transaccional de PostgreSQL");
});

// ── controlador ─────────────────────────────────────────────────────────────

test("el controlador toma el actor del contexto autenticado, valida el id y pasa la correlación del chat", async () => {
  let received: any;
  const controller = new ChatEvidenceAnalysisController({ analyze: async (input: any) => { received = input; return { analysisStatus: "completed" }; } } as never);
  const req = { headers: { "x-request-id": "rid-7", "x-tenant-id": "t1", "x-org-id": "orgA", "x-user-id": "u1", "x-roles": "CLIENT" } };
  const result: any = await controller.analyze(req as never, "ev1", { chatRequestId: "chat-1" });
  assert.equal(result.requestId, "rid-7");
  assert.deepEqual(received.actor.roles, ["CLIENT"]);
  assert.equal(received.actor.tenantId, "t1");
  assert.equal(received.chatRequestId, "chat-1");
  assert.equal(received.evidenceId, "ev1");
  await assert.rejects(controller.analyze(req as never, "bad id!", {}), (e: any) => e.getStatus() === 400);
  await controller.analyze(req as never, "ev1", { chatRequestId: "<script>" });
  assert.equal(received.chatRequestId, undefined, "una correlación con formato inválido se descarta");
});
