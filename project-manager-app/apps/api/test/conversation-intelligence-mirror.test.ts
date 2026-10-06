import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  contentHashOf,
  isMirrorEnabled,
  mapAssistantSession,
  resolveConversationIntelligenceMode,
} from "../dist/modules/assistant/conversation-canonical/conversation-mapping.js";
import { ConversationMirrorService } from "../dist/modules/assistant/conversation-canonical/conversation-mirror.service.js";
import { AssistantService } from "../dist/modules/assistant/assistant.service.js";

// Conversation Intelligence · Ola 1 (CI-004, CI-005, CI-006, CI-012, CI-013): mapeo, idempotencia, aislamiento y flag.

const session = {
  id: "ses_1",
  tenantId: "tenant_a",
  userId: "usr_1",
  flow: "publish_job",
  pageRoute: "/client/jobs/new",
  messages: [
    { role: "user", content: "quiero planear un trabajo" },
    { role: "assistant", content: "¿Qué tipo de trabajo es?" },
    { role: "user", content: "limpieza de casas" },
  ],
};

// ── CI-004: mapping Session → canónico ──────────────────────────────────────

test("CI-004: la sesión se mapea al contrato de la spec §5 sin inventar nada", () => {
  const { thread, messages } = mapAssistantSession(session);
  assert.deepEqual(thread, {
    tenantId: "tenant_a",
    channel: "WEB_CHAT",
    externalThreadId: "assistant:ses_1",
    contactUserId: "usr_1",
    source: "assistant",
    orgId: null,
    metadataJson: { legacy: "conversation_session", sessionId: "ses_1", flow: "publish_job", pageRoute: "/client/jobs/new" },
  });
  assert.equal(messages.length, 3);
  assert.deepEqual(messages.map((m) => m.externalMessageId), ["assistant:ses_1:0", "assistant:ses_1:1", "assistant:ses_1:2"]);
  assert.deepEqual(messages.map((m) => m.sequence), [0, 1, 2]);
  assert.deepEqual(messages.map((m) => m.direction), ["INBOUND", "OUTBOUND", "INBOUND"]);
  assert.deepEqual(messages.map((m) => m.status), ["RECEIVED", "SENT", "RECEIVED"]);
  assert.deepEqual(messages.map((m) => m.senderUserId), ["usr_1", null, "usr_1"]);
  assert.ok(messages.every((m) => m.occurredAt === null), "los mensajes legacy no tienen instante: no se inventa");
  assert.equal(thread.orgId, null, "la sesión no guarda orgId: queda null");
  assert.ok(messages.every((m) => m.rawPayloadJson.legacyIndex === m.sequence && !("body" in m.rawPayloadJson)), "la metadata legacy no duplica el cuerpo");
});

test("CI-004: tolera fuentes raras y el sequence de los demás no se desplaza", () => {
  assert.deepEqual(mapAssistantSession({ ...session, messages: [] }).messages, []);
  assert.deepEqual(mapAssistantSession({ ...session, messages: null }).messages, []);
  assert.deepEqual(mapAssistantSession({ ...session, messages: "no es lista" }).messages, []);
  const mixed = mapAssistantSession({
    ...session,
    messages: [
      { role: "user", content: "a" },
      null,
      { role: "system", content: "ignorado" },
      { role: "assistant", content: 42 },
      { role: "assistant", content: "b" },
    ],
  }).messages;
  assert.deepEqual(mixed.map((m) => [m.sequence, m.body]), [[0, "a"], [4, "b"]], "se conserva la posición ORIGINAL (spec §5)");
});

// ── CI-005: orden estable, contentHash e idempotencia ──────────────────────

test("CI-005: contentHash es estable y cambia con el cuerpo; el mapeo es determinista", () => {
  assert.equal(contentHashOf("hola"), contentHashOf("hola"));
  assert.notEqual(contentHashOf("hola"), contentHashOf("hola "));
  assert.match(contentHashOf("hola"), /^sha256:[0-9a-f]{64}$/);
  assert.deepEqual(mapAssistantSession(session), mapAssistantSession(structuredClone(session)));
});

function fakePrisma() {
  const threads: Array<Record<string, any>> = [];
  const communications: Array<Record<string, any>> = [];
  const calls = { upserts: [] as any[], createManys: [] as any[] };
  const prisma = {
    communicationThread: {
      async upsert(args: any) {
        calls.upserts.push(args);
        const k = args.where.tenantId_channel_externalThreadId;
        let row = threads.find((t) => t.tenantId === k.tenantId && t.channel === k.channel && t.externalThreadId === k.externalThreadId);
        if (!row) { row = { id: `thr_${threads.length + 1}`, ...args.create }; threads.push(row); }
        return { id: row.id };
      },
    },
    communication: {
      async createMany(args: any) {
        calls.createManys.push(args);
        let count = 0;
        for (const data of args.data) {
          const dup = communications.some((c) => c.tenantId === data.tenantId && c.provider === data.provider && c.externalMessageId === data.externalMessageId);
          if (dup && args.skipDuplicates) continue;
          if (dup) throw new Error("unique violation");
          communications.push({ id: `com_${communications.length + 1}`, ...data });
          count += 1;
        }
        return { count };
      },
    },
  };
  return { prisma, threads, communications, calls };
}

test("CI-005: reflejar el mismo turno dos veces no duplica; un turno nuevo solo añade lo nuevo", async () => {
  const { prisma, threads, communications } = fakePrisma();
  const service = new ConversationMirrorService(prisma as never);

  const first = await service.mirrorSession(session, "shadow");
  assert.deepEqual([first!.attempted, first!.inserted], [3, 3]);
  const retry = await service.mirrorSession(session, "shadow");
  assert.deepEqual([retry!.attempted, retry!.inserted], [3, 0], "el reintento no inserta");
  assert.equal(threads.length, 1);
  assert.equal(communications.length, 3);

  const next = await service.mirrorSession({ ...session, messages: [...session.messages, { role: "assistant", content: "Anotado." }] }, "shadow");
  assert.deepEqual([next!.attempted, next!.inserted], [4, 1]);
  assert.equal(communications.length, 4);
  assert.deepEqual(communications.map((c) => c.sequence), [0, 1, 2, 3], "orden estable");
  assert.ok(communications.every((c) => c.threadId === "thr_1"));
});

// ── CI-006: tenant scope ────────────────────────────────────────────────────

test("CI-006: cada escritura lleva el tenant de la sesión, y la misma sesión en otro tenant es otro hilo", async () => {
  const { prisma, threads, communications, calls } = fakePrisma();
  const service = new ConversationMirrorService(prisma as never);
  await service.mirrorSession(session, "live");
  await service.mirrorSession({ ...session, tenantId: "tenant_b", userId: "usr_9" }, "live");

  assert.equal(threads.length, 2, "mismo sessionId en dos tenants ⇒ dos hilos separados");
  for (const upsert of calls.upserts) {
    assert.equal(upsert.where.tenantId_channel_externalThreadId.tenantId, upsert.create.tenantId, "la clave del hilo incluye el tenant");
  }
  assert.deepEqual([...new Set(communications.map((c) => c.tenantId))].sort(), ["tenant_a", "tenant_b"]);
  for (const communication of communications) {
    const thread = threads.find((t) => t.id === communication.threadId)!;
    assert.equal(thread.tenantId, communication.tenantId, "un mensaje nunca cuelga de un hilo de otro tenant");
  }
});

// ── flag y fail-open ────────────────────────────────────────────────────────

test("el modo es off por defecto y ante cualquier valor desconocido; off no toca la base", async () => {
  assert.equal(resolveConversationIntelligenceMode({}), "off");
  assert.equal(resolveConversationIntelligenceMode({ SEMSE_CONVERSATION_INTELLIGENCE_MODE: "on" }), "off");
  assert.equal(resolveConversationIntelligenceMode({ SEMSE_CONVERSATION_INTELLIGENCE_MODE: " Shadow " }), "shadow");
  assert.equal(resolveConversationIntelligenceMode({ SEMSE_CONVERSATION_INTELLIGENCE_MODE: "canary" }), "canary");
  assert.equal(resolveConversationIntelligenceMode({ SEMSE_CONVERSATION_INTELLIGENCE_MODE: "live" }), "live");
  assert.equal(isMirrorEnabled("off"), false);
  for (const mode of ["shadow", "canary", "live"] as const) assert.equal(isMirrorEnabled(mode), true, mode);

  const { prisma, calls } = fakePrisma();
  const service = new ConversationMirrorService(prisma as never);
  assert.equal(await service.mirrorSession(session, "off"), null);
  assert.equal(calls.upserts.length + calls.createManys.length, 0, "con off no hay ninguna escritura");
});

test("un fallo del espejo se cuenta y se registra sin contenido, pero nunca lanza", async () => {
  const broken = { communicationThread: { async upsert() { throw new Error("db down: cuerpo secreto del mensaje"); } }, communication: {} };
  const service = new ConversationMirrorService(broken as never);
  assert.equal(await service.mirrorSession(session, "shadow"), null);
  assert.deepEqual(service.stats, { success: 0, failure: 1, messagesInserted: 0 });
});

// ── CI-013: cableado en el asistente ────────────────────────────────────────

function makeAssistant(mirror: unknown) {
  const updates: Array<Record<string, any>> = [];
  const draft = { id: "d1", completion: 0, categoryId: null, subcategoryId: null, title: null, description: null, city: null, locationType: null, budgetMin: null, budgetMax: null, urgency: null, attachmentsExpected: false };
  const prisma = {
    conversationSession: {
      async findFirst() { return null; },
      async create({ data }: any) { return { id: "ses_new", flow: data.flow, pageRoute: data.pageRoute, messages: [] }; },
      async update(args: any) { updates.push(args); return {}; },
    },
    assistantActionLog: { async create() { return {}; } },
  };
  const drafts = { async getDraft() { return null; }, async createDraft() { return draft; }, async updateDraft() { return draft; } };
  const gateway = { async generate() { return { output: "¿Qué tipo de trabajo es?" }; } };
  const service = new AssistantService(prisma as never, drafts as never, gateway as never, null, null, mirror as never);
  return { service, updates };
}

test("CI-013: cada turno del asistente se refleja con los mensajes completos y el mismo tenant, sin cambiar la respuesta", async () => {
  const mirrored: Array<Record<string, any>> = [];
  const { service, updates } = makeAssistant({ async mirrorSession(s: Record<string, any>) { mirrored.push(s); return null; } });
  const result = await service.handlePublishJob({ message: "quieroplanear un trabajo", tenantId: "tenant_a", orgId: "org_1", userId: "usr_1" });

  assert.equal(result.reply, "¿Qué tipo de trabajo es?");
  assert.equal(result.sessionId, "ses_new");
  assert.equal(updates.length, 1, "la escritura legacy sigue ocurriendo");
  assert.equal(mirrored.length, 1);
  assert.equal(mirrored[0]!.tenantId, "tenant_a");
  assert.equal(mirrored[0]!.userId, "usr_1");
  assert.equal(mirrored[0]!.id, "ses_new");
  assert.deepEqual(mirrored[0]!.messages, [
    { role: "user", content: "quieroplanear un trabajo" },
    { role: "assistant", content: "¿Qué tipo de trabajo es?" },
  ]);
});

test("CI-013: sin el servicio registrado o con un espejo que falla, el asistente responde igual", async () => {
  const without = makeAssistant(undefined);
  assert.equal((await without.service.handlePublishJob({ message: "hola", tenantId: "t", orgId: "o", userId: "u" })).reply, "¿Qué tipo de trabajo es?");

  const failing = new ConversationMirrorService({ communicationThread: { async upsert() { throw new Error("boom"); } }, communication: {} } as never);
  const withFailure = makeAssistant(failing);
  const previous = process.env.SEMSE_CONVERSATION_INTELLIGENCE_MODE;
  process.env.SEMSE_CONVERSATION_INTELLIGENCE_MODE = "live";
  try {
    const result = await withFailure.service.handlePublishJob({ message: "hola", tenantId: "t", orgId: "o", userId: "u" });
    assert.equal(result.reply, "¿Qué tipo de trabajo es?");
    assert.equal(withFailure.updates.length, 1);
  } finally {
    if (previous === undefined) delete process.env.SEMSE_CONVERSATION_INTELLIGENCE_MODE; else process.env.SEMSE_CONVERSATION_INTELLIGENCE_MODE = previous;
  }
  assert.equal(failing.stats.failure, 1);
});

test("el espejo está registrado en el módulo del asistente", () => {
  const moduleSource = readFileSync(path.resolve(import.meta.dirname, "../src/modules/assistant/assistant.module.ts"), "utf8");
  assert.match(moduleSource, /providers: \[AssistantService, ProjectDraftService, ConversationMirrorService\]/);
});
