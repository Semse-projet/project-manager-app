import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { AgroIntakeService } from "../dist/modules/agro/agro-intake.service.js";
import { AgroFarmAccessService } from "../dist/modules/agro/agro-farm-access.service.js";
import {
  classifyIncident, detectCompletion, detectSpecies, extractNumberedRefs, matchEntities, normalizeText,
} from "../dist/modules/agro/agro-intake.domain.js";
import { findPrometeoToolDescriptor } from "../dist/modules/prometeo/prometeo-tool-registry.js";

// ── Dominio ──────────────────────────────────────────────────────────────────

test("agro-intake: normalizes accents and punctuation", () => {
  assert.equal(normalizeText("¡Ya alimenté los cerdos del Corral 8!"), "ya alimente los cerdos del corral 8");
});

test("agro-intake: classifies the brief's examples", () => {
  assert.equal(classifyIncident(normalizeText("Este cerdito tiene una herida en el cachete."))?.type, "ANIMAL_INJURY");
  assert.equal(classifyIncident(normalizeText("Al lote 15 le falta agua."))?.type, "WATER_SHORTAGE");
  assert.equal(classifyIncident(normalizeText("Amaneció muerta una gallina en el galpón 2"))?.type, "ANIMAL_MORTALITY");
  assert.equal(classifyIncident(normalizeText("El tractor no arranca"))?.type, "EQUIPMENT_FAILURE");
  assert.equal(classifyIncident(normalizeText("Hay plaga de gusano en el maíz"))?.type, "PEST_OBSERVED");
  assert.equal(classifyIncident(normalizeText("todo bien hoy")), null);
});

test("agro-intake: detects completed work and species", () => {
  assert.deepEqual(detectCompletion(normalizeText("Ya alimenté los cerdos del corral 8.")), { taskType: "FEEDING" });
  assert.equal(detectCompletion(normalizeText("Al lote 15 le falta agua.")), null);
  assert.equal(detectSpecies(normalizeText("Este cerdito tiene una herida")), "PIG");
  assert.equal(detectSpecies(normalizeText("el ternero cojea")), "CATTLE");
});

test("agro-intake: matches real farm entity names and numbered refs", () => {
  const n = normalizeText("Al lote 15 le falta agua cerca del Corral 8");
  assert.deepEqual(extractNumberedRefs(n), [{ kind: "lote", ref: "15" }, { kind: "corral", ref: "8" }]);
  const m = matchEntities(n, [
    { id: "g15", name: "Lote 15 engorde", kind: "ANIMAL_GROUP" },
    { id: "g1", name: "Lote 1", kind: "ANIMAL_GROUP" },
    { id: "u8", name: "Corral 8", kind: "FARM_UNIT" },
    { id: "a1", name: "123", kind: "ANIMAL" },
  ]);
  assert.deepEqual(m.map((x) => x.id).sort(), ["g15", "u8"]);
  assert.equal(m.find((x) => x.id === "u8")!.confidence, 0.95);
});

test("agro-intake: Prometeo tools registered with correct governance", () => {
  const propose = findPrometeoToolDescriptor("agro", "propose_intake");
  assert.equal(propose?.mode, "read");
  const create = findPrometeoToolDescriptor("agro", "create_incident");
  assert.equal(create?.mode, "write");
  assert.equal(create?.approvalPolicy, "confirm", "creating an incident always needs human confirmation");
  assert.equal(findPrometeoToolDescriptor("agro", "list_inventory")?.endpoint.path, "/v1/agro/farms/:farmId/inventory/items");
  assert.equal(findPrometeoToolDescriptor("agro", "get_cost_summary")?.endpoint.path, "/v1/agro/farms/:farmId/costs/summary");
});

// ── Servicio ─────────────────────────────────────────────────────────────────

function setup(opts: {
  openIncidents?: any[]; openTasks?: any[]; evidenceRows?: any[]; vision?: any;
} = {}) {
  const writes: string[] = [];
  const readOnly = (rows: any[]) => ({ findMany: async () => rows, create: async () => { writes.push("create"); } });
  const prisma = {
    agroFarm: { findUnique: async ({ where }: any) => (where.id === "farm_1" ? { ownerId: "owner" } : null) },
    agroFarmMember: { findUnique: async ({ where }: any) => (where.farmId_userId.userId === "worker" ? { role: "WORKER", status: "ACTIVE" } : null) },
    agroFarmUnit: readOnly([{ id: "u8", name: "Corral 8" }]),
    agroAnimalGroup: readOnly([{ id: "g15", name: "Lote 15", species: "PIG" }]),
    agroAnimal: readOnly([{ id: "a7", tagCode: "C-107", species: "PIG" }]),
    agroIncident: { findMany: async () => opts.openIncidents ?? [], create: async () => { writes.push("incident"); } },
  } as never;
  const tasks = { listOpen: async () => opts.openTasks ?? [] } as never;
  const evidence = { findEvidenceInFarm: async () => opts.evidenceRows ?? [] } as never;
  const svc = new AgroIntakeService(prisma, new AgroFarmAccessService(prisma), tasks, evidence, opts.vision);
  return { svc, writes };
}

test("agro-intake: 'Al lote 15 le falta agua' → WATER_SHORTAGE proposal on Lote 15, HIGH suggested, human review", async () => {
  const { svc, writes } = setup();
  const p = await svc.propose("farm_1", "worker", { text: "Al lote 15 le falta agua." });
  assert.equal(p.intent, "INCIDENT");
  assert.equal(p.incident.type, "WATER_SHORTAGE");
  assert.equal(p.incident.suggestedSeverity, "HIGH");
  assert.equal(p.incident.severityConfirmed, false);
  assert.equal(p.incident.relations.animalGroupId, "g15");
  assert.equal(p.incident.source, "PROMETEO");
  assert.equal(p.reporter.userId, "worker");
  assert.equal(p.requiresHumanReview, true);
  assert.match(p.disclaimer, /no emite diagn/i);
  assert.equal(p.recommendedAction.kind, "CREATE_INCIDENT");
  assert.deepEqual(writes, [], "propose never writes");
});

test("agro-intake: injury report on a pig — no diagnosis, species detected", async () => {
  const { svc } = setup();
  const p = await svc.propose("farm_1", "worker", { text: "Este cerdito tiene una herida en el cachete." });
  assert.equal(p.incident.type, "ANIMAL_INJURY");
  assert.equal(p.incident.category, "ANIMAL_HEALTH_WELFARE");
  assert.equal(p.entities.species, "PIG");
  assert.ok(!("diagnosis" in p.incident));
});

test("agro-intake: existing open incident → relate before creating", async () => {
  const { svc } = setup({ openIncidents: [{ id: "inc_9", title: "Sin agua lote 15", status: "OPEN", severity: "HIGH" }] });
  const p = await svc.propose("farm_1", "worker", { text: "Al lote 15 le falta agua" });
  assert.equal(p.recommendedAction.kind, "LINK_EXISTING_INCIDENT");
  assert.equal(p.recommendedAction.incidentId, "inc_9");
});

test("agro-intake: 'Ya alimenté los cerdos del corral 8' → matches the pending FEEDING task, not a new one", async () => {
  const openTasks = [
    { source: "AGRO_FARM_TASK", id: "t_clean", title: "Limpiar corral 8", type: "CLEANING", status: "PENDING", targetType: "FARM_UNIT", targetId: "u8", dueAt: null },
    { source: "AGRO_FARM_TASK", id: "t_feed_8", title: "Alimentar corral 8", type: "FEEDING", status: "PENDING", targetType: "FARM_UNIT", targetId: "u8", dueAt: null },
    { source: "JOB_TASK", id: "jt_feed_2", title: "Alimentar corral 2", type: "FEEDING", status: "PENDING", targetType: "FARM_UNIT", targetId: "u2", dueAt: null },
  ];
  const { svc } = setup({ openTasks });
  const p = await svc.propose("farm_1", "worker", { text: "Ya alimenté los cerdos del corral 8." });
  assert.equal(p.intent, "TASK_COMPLETION");
  assert.equal(p.recommendedAction.kind, "COMPLETE_TASK");
  assert.equal(p.recommendedAction.task.id, "t_feed_8");
  assert.equal(p.taskMatches[0].score, 1);
});

test("agro-intake: no matching open task → propose creating one (last resort)", async () => {
  const { svc } = setup({ openTasks: [] });
  const p = await svc.propose("farm_1", "worker", { text: "Ya alimenté los cerdos del corral 8." });
  assert.equal(p.recommendedAction.kind, "CREATE_TASK");
  assert.equal(p.recommendedAction.draft.type, "FEEDING");
  assert.equal(p.recommendedAction.draft.targetId, "u8");
});

test("agro-intake: unknown text asks the human; empty and non-member rejected", async () => {
  const { svc } = setup();
  const p = await svc.propose("farm_1", "worker", { text: "Buenos días" });
  assert.equal(p.intent, "UNKNOWN");
  assert.equal(p.recommendedAction.kind, "ASK_HUMAN");
  await assert.rejects(() => svc.propose("farm_1", "worker", { text: "  " }), BadRequestException);
  await assert.rejects(() => svc.propose("farm_1", "stranger", { text: "falta agua" }), NotFoundException);
});

// ── T-054: ASR (audio → texto) y visión (fotos) ─────────────────────────────

function withTranscriptionStub(svc: any, segmentsByUrl: Record<string, Array<{ text: string }>>) {
  svc.transcriptionProviderResolver = () => ({
    transcribe: async ({ storageKey }: { storageKey: string }) => segmentsByUrl[storageKey] ?? [],
  });
}

test("agro-intake T-054: no text, audio evidence present → transcribes and proceeds", async () => {
  const evidenceRows = [{ id: "ev_audio", mediaType: "AUDIO", fileUrl: "https://cdn.test/audio1.m4a" }];
  const { svc } = setup({ evidenceRows });
  withTranscriptionStub(svc, { "https://cdn.test/audio1.m4a": [{ text: "Al lote 15 le falta agua." }] });

  const p = await svc.propose("farm_1", "worker", { evidenceIds: ["ev_audio"] });
  assert.equal(p.intent, "INCIDENT");
  assert.equal(p.incident.type, "WATER_SHORTAGE");
  assert.deepEqual(p.transcribedFrom, ["ev_audio"]);
});

test("agro-intake T-054: no text, no audio, no ASR provider configured → clear error, not a generic one", async () => {
  const evidenceRows = [{ id: "ev_audio", mediaType: "AUDIO", fileUrl: "https://cdn.test/audio1.m4a" }];
  const { svc } = setup({ evidenceRows });
  svc.transcriptionProviderResolver = () => null; // SEMSE_ASR_PROVIDER not set — real default

  await assert.rejects(
    () => svc.propose("farm_1", "worker", { evidenceIds: ["ev_audio"] }),
    (err: unknown) => err instanceof BadRequestException && /transcription provider is configured/.test((err as Error).message),
  );
});

test("agro-intake T-054: text already provided → does not attempt transcription even with audio evidence", async () => {
  const evidenceRows = [{ id: "ev_audio", mediaType: "AUDIO", fileUrl: "https://cdn.test/audio1.m4a" }];
  const { svc } = setup({ evidenceRows });
  let called = false;
  svc.transcriptionProviderResolver = () => { called = true; return { transcribe: async () => [] }; };

  const p = await svc.propose("farm_1", "worker", { text: "Al lote 15 le falta agua.", evidenceIds: ["ev_audio"] });
  assert.equal(p.intent, "INCIDENT");
  assert.equal(called, false, "text was already provided — no need to transcribe");
  assert.deepEqual(p.transcribedFrom, []);
});

test("agro-intake T-054: photo evidence → vision candidates attached, best-effort", async () => {
  const evidenceRows = [{ id: "ev_photo", mediaType: "PHOTO", fileUrl: "https://cdn.test/photo1.jpg" }];
  const vision = { recognize: async (url: string) => (url === "https://cdn.test/photo1.jpg" ? { provider: "ollama", model: "qwen2.5vl:3b", candidates: [{ slug: "pig", label: "Pig", confidence: 0.8 }] } : null) };
  const { svc } = setup({ evidenceRows, vision });

  const p = await svc.propose("farm_1", "worker", { text: "Este cerdito tiene una herida en el cachete.", evidenceIds: ["ev_photo"] });
  assert.equal(p.visionSignals.length, 1);
  assert.equal(p.visionSignals[0].evidenceId, "ev_photo");
  assert.equal(p.visionSignals[0].candidates[0].slug, "pig");
});

test("agro-intake T-054: vision disabled/unavailable → empty signals, proposal still returned", async () => {
  const evidenceRows = [{ id: "ev_photo", mediaType: "PHOTO", fileUrl: "https://cdn.test/photo1.jpg" }];
  const { svc } = setup({ evidenceRows }); // sin vision inyectada (@Optional())

  const p = await svc.propose("farm_1", "worker", { text: "Al lote 15 le falta agua.", evidenceIds: ["ev_photo"] });
  assert.deepEqual(p.visionSignals, []);
});
