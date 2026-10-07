import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { ChatEvidenceService } from "../dist/modules/ai-models/chat-evidence/chat-evidence.service.js";

// prometeo.chat-evidence · Wave 1 (CE-010..CE-013). Dobles en memoria que SÍ aplican el `where` recibido, para que una
// consulta sin acotar se note (no basta con comprobar que se llamó).

type Ev = { id: string; tenantId: string; projectId: string; kind: string; bucketKey: string; fileUrl: string | null; validationStatus: string; capturedAt: Date | null; createdAt: Date; milestoneTitle?: string };
type Proj = { id: string; tenantId: string; clientOrgId: string; proOrgId: string | null; jobTitle: string };
type Va = { evidenceId: string; status: string; qualityScore: number | null; riskLevel: string | null; riskReasons: unknown; requiresHumanReview: boolean; recommendedAction: string | null; rawResult: unknown; canAutoApprove: boolean };

const day = (n: number) => new Date(Date.UTC(2026, 9, n));
const ev = (id: string, tenantId: string, projectId: string, over: Partial<Ev> = {}): Ev => ({
  id, tenantId, projectId, kind: "PHOTO", bucketKey: `${tenantId}/${id}.jpg`, fileUrl: `https://files.example/${id}.jpg`,
  validationStatus: "pending", capturedAt: null, createdAt: day(1), ...over,
});

function world(opts: { projects: Proj[]; evidences: Ev[]; analyses?: Va[]; failResolver?: boolean }) {
  const calls = { vaIds: [] as string[][], evidenceSelect: [] as any[], vaSelect: [] as any[], resolver: [] as string[][] };
  const matches = (e: Ev, where: any) =>
    e.tenantId === where.tenantId &&
    (where.validationStatus === undefined || e.validationStatus === where.validationStatus) &&
    (where.projectId?.in === undefined || where.projectId.in.includes(e.projectId));
  const prisma = {
    evidence: {
      count: async ({ where }: any) => opts.evidences.filter((e) => matches(e, where)).length,
      findMany: async (args: any) => {
        calls.evidenceSelect.push(args.select);
        const rows = opts.evidences.filter((e) => matches(e, args.where))
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))
          .slice(0, args.take ?? 1000);
        return rows.map((e) => ({
          ...e, project: { job: { title: opts.projects.find((p) => p.id === e.projectId)?.jobTitle ?? null } },
          milestone: e.milestoneTitle ? { title: e.milestoneTitle } : null,
        }));
      },
    },
    visionAnalysis: {
      findMany: async (args: any) => {
        calls.vaIds.push(args.where.evidenceId.in);
        calls.vaSelect.push(args.select);
        return (opts.analyses ?? []).filter((a) => args.where.evidenceId.in.includes(a.evidenceId));
      },
    },
  };
  const resolver = {
    listAccessibleProjectIds: async (tenantId: string, orgId: string) => {
      calls.resolver.push([tenantId, orgId]);
      if (opts.failResolver) throw new Error("422 demasiados proyectos");
      return opts.projects.filter((p) => p.tenantId === tenantId && (p.clientOrgId === orgId || p.proOrgId === orgId)).map((p) => p.id);
    },
  };
  return { service: new ChatEvidenceService(prisma as never, resolver as never), calls };
}

const P = (id: string, tenantId: string, clientOrgId: string, proOrgId: string | null = null): Proj => ({ id, tenantId, clientOrgId, proOrgId, jobTitle: `Obra ${id}` });
const baseWorld = () => ({
  projects: [P("pA1", "t1", "orgA", "orgPro"), P("pB1", "t1", "orgB"), P("pX1", "t2", "orgA")],
  evidences: [ev("eA1", "t1", "pA1"), ev("eB1", "t1", "pB1"), ev("eX1", "t2", "pX1")],
});
const ids = (r: { items: Array<{ id: string }> }) => r.items.map((i) => i.id).sort();

// ── CE-010 alcance ──────────────────────────────────────────────────────────

test("CE-010: un cliente solo ve evidencias de los proyectos de su organización", async () => {
  const { service } = world(baseWorld());
  assert.deepEqual(ids(await service.listPending({ tenantId: "t1", orgId: "orgA", userId: "u1", roles: ["CLIENT"] })), ["eA1"]);
});

test("CE-010: el profesional asignado ve las de sus proyectos", async () => {
  const { service } = world(baseWorld());
  assert.deepEqual(ids(await service.listPending({ tenantId: "t1", orgId: "orgPro", userId: "u2", roles: ["PRO"] })), ["eA1"]);
});

test("CE-010: otra organización o sin organización ⇒ vacío", async () => {
  const { service } = world(baseWorld());
  assert.deepEqual((await service.listPending({ tenantId: "t1", orgId: "orgZ", userId: "u", roles: ["CLIENT"] })).items, []);
  const none = await service.listPending({ tenantId: "t1", orgId: "", userId: "u", roles: ["CLIENT"] });
  assert.deepEqual(none, { items: [], total: 0, remaining: 0 });
});

test("CE-010: OPS_ADMIN ve todo SU tenant y nunca otro", async () => {
  const { service } = world(baseWorld());
  assert.deepEqual(ids(await service.listPending({ tenantId: "t1", orgId: "orgAdmin", userId: "a", roles: ["OPS_ADMIN"] })), ["eA1", "eB1"]);
  assert.deepEqual(ids(await service.listPending({ tenantId: "t2", orgId: "orgAdmin", userId: "a", roles: ["OPS_ADMIN"] })), ["eX1"]);
});

test("CE-010: el mismo id de organización en otro tenant no hereda nada", async () => {
  const { service } = world(baseWorld());
  const r = await service.listPending({ tenantId: "t1", orgId: "orgA", userId: "u", roles: ["CLIENT"] });
  assert.equal(r.items.some((i) => i.id === "eX1"), false);
});

test("CE-010: si el listado de proyectos falla ⇒ vacío, nunca el tenant completo", async () => {
  const { service } = world({ ...baseWorld(), failResolver: true });
  assert.deepEqual(await service.listPending({ tenantId: "t1", orgId: "orgA", userId: "u", roles: ["CLIENT"] }), { items: [], total: 0, remaining: 0 });
});

// ── CE-011 selección ────────────────────────────────────────────────────────

test("CE-011: solo pending, más antiguas primero, tope 10 y remaining correcto", async () => {
  const evidences = [
    ...Array.from({ length: 13 }, (_, i) => ev(`e${String(i).padStart(2, "0")}`, "t1", "pA1", { createdAt: day(20 - i) })),
    ev("ePassed", "t1", "pA1", { validationStatus: "passed" }), ev("eFailed", "t1", "pA1", { validationStatus: "failed" }),
  ];
  const { service } = world({ projects: baseWorld().projects, evidences });
  const r = await service.listPending({ tenantId: "t1", orgId: "orgA", userId: "u", roles: ["CLIENT"] });
  assert.equal(r.items.length, 10);
  assert.equal(r.total, 13);
  assert.equal(r.remaining, 3);
  assert.equal(r.items[0]!.id, "e12", "la más antigua (día 8) primero");
  assert.equal(r.items.some((i) => i.id === "ePassed" || i.id === "eFailed"), false);
});

// ── CE-012 unión con VisionAnalysis ─────────────────────────────────────────

test("CE-012: el estado del análisis se informa tal cual y el análisis solo se consulta para las evidencias ya acotadas", async () => {
  const va = (evidenceId: string, status: string): Va => ({ evidenceId, status, qualityScore: 71.5, riskLevel: "medium", riskReasons: ["Borroso", 7, null], requiresHumanReview: true, recommendedAction: "manual_review", rawResult: { secret: "RAW" }, canAutoApprove: true });
  const w = baseWorld();
  w.evidences.push(ev("eA2", "t1", "pA1"), ev("eA3", "t1", "pA1"));
  const { service, calls } = world({ ...w, analyses: [va("eA1", "completed"), va("eA2", "failed"), va("eB1", "completed"), va("eX1", "completed")] });
  const r = await service.listPending({ tenantId: "t1", orgId: "orgA", userId: "u", roles: ["CLIENT"] });
  const by = Object.fromEntries(r.items.map((i) => [i.id, i]));
  assert.equal(by.eA1!.analysisStatus, "completed");
  assert.equal(by.eA1!.qualityScore, 71.5);
  assert.deepEqual(by.eA1!.riskReasons, ["Borroso"], "solo cadenas");
  assert.equal(by.eA2!.analysisStatus, "failed");
  assert.equal(by.eA3!.analysisStatus, "none");
  assert.deepEqual(calls.vaIds.flat().sort(), ["eA1", "eA2", "eA3"], "nunca ids fuera del alcance");
  assert.equal("rawResult" in calls.vaSelect[0], false);
  assert.equal("canAutoApprove" in calls.vaSelect[0], false);
});

test("CE-012: sin evidencias en alcance no se consulta el análisis", async () => {
  const { service, calls } = world(baseWorld());
  await service.listPending({ tenantId: "t1", orgId: "orgZ", userId: "u", roles: ["CLIENT"] });
  assert.equal(calls.vaIds.length, 0);
});

// ── CE-013 analyzable y no-fuga ─────────────────────────────────────────────

test("CE-013: analyzable exige imagen real y análisis no completado; bucketKey/fileUrl nunca salen", async () => {
  const w = baseWorld();
  w.evidences.push(ev("eVideo", "t1", "pA1", { kind: "VIDEO" }), ev("eNoKey", "t1", "pA1", { bucketKey: "" }), ev("eDone", "t1", "pA1"), ev("eFail", "t1", "pA1"));
  const analyses: Va[] = [
    { evidenceId: "eDone", status: "completed", qualityScore: 90, riskLevel: "low", riskReasons: [], requiresHumanReview: false, recommendedAction: null, rawResult: {}, canAutoApprove: false },
    { evidenceId: "eFail", status: "failed", qualityScore: null, riskLevel: null, riskReasons: null, requiresHumanReview: true, recommendedAction: null, rawResult: null, canAutoApprove: false },
  ];
  const { service } = world({ ...w, analyses });
  const r = await service.listPending({ tenantId: "t1", orgId: "orgA", userId: "u", roles: ["CLIENT"] });
  const by = Object.fromEntries(r.items.map((i) => [i.id, i]));
  assert.equal(by.eA1!.analyzable, true);
  assert.equal(by.eFail!.analyzable, true, "un análisis fallido se puede reintentar");
  assert.equal(by.eDone!.analyzable, false);
  assert.equal(by.eVideo!.analyzable, false);
  assert.equal(by.eNoKey!.analyzable, false);
  const json = JSON.stringify(r);
  for (const leak of ["bucketKey", "fileUrl", "files.example", "t1/eA1.jpg", "rawResult", "canAutoApprove"]) assert.equal(json.includes(leak), false, leak);
});
