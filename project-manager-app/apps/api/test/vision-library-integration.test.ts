import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { VisionLibraryRepository } from "../dist/modules/vision/vision-library.repository.js";
import { VisionLibraryService } from "../dist/modules/vision/vision-library.service.js";

// Sense Vision — persistence + service against a real Postgres with the
// versioned migration (and its library seed) applied.
// Spec: docs/specs/vision/sense-vision-field-library.spec.md §4 (P1–P4, P10–P12) / §9.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(path.resolve(__dirname, "..", "..", ".."), "packages/db/.env") });

const prisma = new PrismaClient();
const dbTest = process.env.DATABASE_URL ? test : test.skip;

const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const TENANT = `tenant_vision_${suffix}`;
const OTHER_TENANT = `tenant_vision_other_${suffix}`;
const USER_ID = `usr_vision_${suffix}`;
const actor = { tenantId: TENANT, orgId: `org_${suffix}`, userId: USER_ID, requestId: `req_${suffix}` };

const auditEntries: any[] = [];
const audit = { append: async (entry: any) => void auditEntries.push(entry) };

function buildService(clientImpl: { recognizeObjects: (payload: any) => Promise<any> }) {
  return new VisionLibraryService(new VisionLibraryRepository(prisma as any), clientImpl as any, audit as any);
}

const noClient = { recognizeObjects: async () => ({ disabled: true }) };

test.before(async () => {
  if (!process.env.DATABASE_URL) return;
  await prisma.user.create({ data: { id: USER_ID, email: `${USER_ID}@vision.test` } });
});

test.after(async () => {
  if (process.env.DATABASE_URL) {
    await prisma.visionCorrection.deleteMany({ where: { userId: USER_ID } });
    await prisma.userDictionaryItem.deleteMany({ where: { userId: USER_ID } });
    await prisma.constructionLibraryItem.deleteMany({ where: { slug: { startsWith: "test-dup-" } } });
    await prisma.user.deleteMany({ where: { id: USER_ID } });
  }
  await prisma.$disconnect();
});

dbTest("migration seeds the canonical library with unique slugs", async () => {
  const count = await prisma.constructionLibraryItem.count({ where: { id: { startsWith: "cli_" } } });
  assert.ok(count >= 100, `expected ≥ 100 seeded items, got ${count}`);
  const coupling = await prisma.constructionLibraryItem.findUnique({ where: { slug: "emt-coupling" } });
  assert.equal(coupling?.nameEs, "Copla EMT");
  assert.equal(coupling?.id, "cli_emt_coupling");

  await prisma.constructionLibraryItem.create({
    data: {
      slug: "test-dup-item", canonicalName: "x", nameEn: "x", nameEs: "x", category: "tools", subcategory: "x",
      descriptionEn: "x", descriptionEs: "x", usageEn: "x", usageEs: "x", exampleSentenceEn: "x",
      exampleSentenceEs: "x", searchText: "x",
    },
  });
  await assert.rejects(
    prisma.constructionLibraryItem.create({
      data: {
        slug: "test-dup-item", canonicalName: "y", nameEn: "y", nameEs: "y", category: "tools", subcategory: "y",
        descriptionEn: "y", descriptionEs: "y", usageEn: "y", usageEs: "y", exampleSentenceEn: "y",
        exampleSentenceEs: "y", searchText: "y",
      },
    }),
    (error: any) => error?.code === "P2002",
  );
});

dbTest("manual search works in English, Spanish and by alias", async () => {
  const service = buildService(noClient);
  for (const [q, slug] of [
    ["fish tape", "fish-tape"],
    ["cinta guía", "fish-tape"],
    ["channel locks", "tongue-and-groove-pliers"],
    ["pinza de canal", "tongue-and-groove-pliers"],
  ]) {
    const result = await service.searchLibrary({ q, limit: 5 });
    assert.equal(result.items[0]?.slug, slug, q);
  }
  const electrical = await service.searchLibrary({ category: "electrical", trade: "electrical", limit: 50 });
  assert.ok(electrical.items.length > 0);
  assert.ok(electrical.items.every((item: any) => item.category === "electrical" && item.trades.includes("electrical")));
  const bySlug = await service.getLibraryItem("emt-connector");
  const byId = await service.getLibraryItem(bySlug.id);
  assert.equal(byId.slug, "emt-connector");
  await assert.rejects(service.getLibraryItem("does-not-exist"), /not found/i);
});

dbTest("saving a word twice never duplicates and counts scans", async () => {
  const service = buildService(noClient);
  const first = await service.saveToDictionary(actor, "cli_emt_coupling", "scan");
  const second = await service.saveToDictionary(actor, "cli_emt_coupling", "scan");
  await service.saveToDictionary(actor, "cli_emt_coupling", "search");
  assert.equal(first.id, second.id);
  const rows = await prisma.userDictionaryItem.findMany({ where: { userId: USER_ID, libraryItemId: "cli_emt_coupling" } });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].timesScanned, 2);
  assert.equal(second.item.nameEn, "EMT coupling");
  assert.ok(auditEntries.some((e) => e.action === "vision.dictionary_saved" && e.afterJson.slug === "emt-coupling"));
  await assert.rejects(service.saveToDictionary(actor, "cli_does_not_exist"), /not found/i);
});

dbTest("favorite / learned / notes / viewed update only the caller's entry", async () => {
  const service = buildService(noClient);
  await service.saveToDictionary(actor, "cli_fish_tape", "manual");
  const updated = await service.updateDictionaryEntry(actor, "cli_fish_tape", { favorite: true, learned: true, notes: "for pulls", viewed: true });
  assert.equal(updated.favorite, true);
  assert.equal(updated.learned, true);
  assert.equal(updated.notes, "for pulls");
  assert.equal(updated.timesViewed, 1);

  await assert.rejects(
    service.updateDictionaryEntry({ ...actor, tenantId: OTHER_TENANT }, "cli_fish_tape", { favorite: false }),
    /not in your dictionary/i,
  );

  const list = await service.listDictionary(actor, {});
  assert.equal(list.stats.total, 2);
  assert.equal(list.stats.learned, 1);
  assert.equal(list.stats.favorites, 1);
  assert.equal(list.stats.addedThisWeek, 2);
  const favorites = await service.listDictionary(actor, { favorite: true });
  assert.deepEqual(favorites.entries.map((e: any) => e.item.slug), ["fish-tape"]);
  const searched = await service.listDictionary(actor, { q: "copla" });
  assert.deepEqual(searched.entries.map((e: any) => e.item.slug), ["emt-coupling"]);
  const otherTenant = await service.listDictionary({ ...actor, tenantId: OTHER_TENANT }, {});
  assert.equal(otherTenant.entries.length, 0);
});

dbTest("removing a word deletes only the dictionary row, never the library item", async () => {
  const service = buildService(noClient);
  assert.deepEqual(await service.removeFromDictionary(actor, "cli_fish_tape"), { removed: true });
  assert.deepEqual(await service.removeFromDictionary(actor, "cli_fish_tape"), { removed: false });
  assert.ok(await prisma.constructionLibraryItem.findUnique({ where: { id: "cli_fish_tape" } }));
  assert.ok(auditEntries.some((e) => e.action === "vision.dictionary_removed"));
});

dbTest("corrections are recorded, validated and audited", async () => {
  const service = buildService(noClient);
  const correction = await service.recordCorrection(actor, {
    predictedLibraryItemId: "cli_emt_coupling",
    selectedLibraryItemId: "cli_emt_connector",
    predictedConfidence: 0.62,
    source: "ollama:qwen2.5vl:3b",
  });
  const row = await prisma.visionCorrection.findUnique({ where: { id: correction.id } });
  assert.equal(row?.selectedLibraryItemId, "cli_emt_connector");
  assert.equal(row?.tenantId, TENANT);
  const notInList = await service.recordCorrection(actor, { predictedLibraryItemId: "cli_emt_coupling", selectedLibraryItemId: null, source: "manual" });
  assert.ok(notInList.id);
  await assert.rejects(
    service.recordCorrection(actor, { predictedLibraryItemId: "cli_nope", source: "manual" }),
    /not found/i,
  );
  assert.ok(auditEntries.some((e) => e.action === "vision.recognition_corrected"));
  // Recording a correction never mutates the library.
  const coupling = await prisma.constructionLibraryItem.findUnique({ where: { id: "cli_emt_coupling" } });
  assert.equal(coupling?.nameEn, "EMT coupling");
});

dbTest("recognize: library enrichment, provider disabled, provider failure", async () => {
  let sentVocabulary: any[] = [];
  const recognized = await buildService({
    recognizeObjects: async (payload: any) => {
      sentVocabulary = payload.vocabulary;
      assert.equal(payload.imageData, "AAAA");
      return { disabled: false, body: { provider: "ollama", model: "qwen2.5vl:3b", candidates: [{ slug: "emt-coupling", label: "EMT coupling", confidence: 0.91 }] } };
    },
  }).recognize({ kind: "data", imageData: "AAAA", mimeType: "image/jpeg", byteLength: 3 });
  assert.equal(recognized.status, "recognized");
  assert.equal(recognized.object?.nameEs, "Copla EMT");
  assert.equal(recognized.source, "ollama:qwen2.5vl:3b");
  assert.ok(sentVocabulary.some((entry) => entry.slug === "emt-coupling" && entry.name === "EMT coupling"));
  assert.ok(recognized.latencyMs >= 0);

  const disabled = await buildService(noClient).recognize({ kind: "url", imageUrl: "https://x.railway.app/a.jpg" });
  assert.equal(disabled.status, "unavailable");
  assert.equal(disabled.reason, "provider_disabled");

  const failed = await buildService({ recognizeObjects: async () => { throw new Error("boom"); } })
    .recognize({ kind: "url", imageUrl: "https://x.railway.app/a.jpg" });
  assert.equal(failed.status, "error");
  assert.equal(failed.object, null);
});
