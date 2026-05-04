import test from "node:test";
import assert from "node:assert/strict";
import { ProjectDraftService } from "../dist/modules/assistant/project-draft.service.js";
import { parseDraftBlock } from "../dist/modules/assistant/assistant.service.js";

// ── computeCompletion tests ──────────────────────────────────────────────────

test("computeCompletion returns 0 for empty draft", () => {
  const service = new ProjectDraftService({ projectDraft: {} } as never);
  const result = service.computeCompletion({
    categoryId: null,
    subcategoryId: null,
    title: null,
    description: null,
    city: null,
    locationType: null,
    budgetMin: null,
    budgetMax: null,
    urgency: null,
  });
  assert.equal(result, 0);
});

test("computeCompletion returns correct value when some fields are set", () => {
  const service = new ProjectDraftService({ projectDraft: {} } as never);
  const result = service.computeCompletion({
    categoryId: "electricidad",
    subcategoryId: "instalacion_elec",
    title: "Instalación eléctrica",
    description: null,
    city: null,
    locationType: null,
    budgetMin: null,
    budgetMax: null,
    urgency: null,
  });
  assert.equal(result, 45);
});

test("computeCompletion returns 100 when all fields set", () => {
  const service = new ProjectDraftService({ projectDraft: {} } as never);
  const result = service.computeCompletion({
    categoryId: "electricidad",
    subcategoryId: "instalacion_elec",
    title: "Instalación eléctrica residencial completa",
    description: "Casa de 4 cuartos, 2 baños y 1 cocina necesita instalación nueva",
    city: "Miami",
    locationType: "on_site",
    budgetMin: 1000,
    budgetMax: 3000,
    urgency: "medium",
  });
  assert.equal(result, 100);
});

// ── parseDraftBlock tests ────────────────────────────────────────────────────

test("parseDraftBlock extracts fields from [DRAFT]...[/DRAFT]", () => {
  const text = `[DRAFT]
{
  "categoryId": "electricidad",
  "subcategoryId": "instalacion_elec",
  "title": "Instalación eléctrica",
  "description": "Casa de 4 cuartos con instalación nueva completa",
  "city": "Miami",
  "locationType": "on_site",
  "budgetMin": null,
  "budgetMax": null,
  "urgency": "medium"
}
[/DRAFT]

Entendido, ¿en qué ciudad necesitas el trabajo?`;

  const result = parseDraftBlock(text);
  assert.notEqual(result, null);
  assert.equal(result?.categoryId, "electricidad");
  assert.equal(result?.subcategoryId, "instalacion_elec");
  assert.equal(result?.title, "Instalación eléctrica");
  assert.equal(result?.city, "Miami");
  assert.equal(result?.budgetMin, null);
  assert.equal(result?.urgency, "medium");
});

test("parseDraftBlock returns null if no block present", () => {
  const text = "¿Cuál es la categoría del trabajo que necesitas?";
  const result = parseDraftBlock(text);
  assert.equal(result, null);
});

// ── ProjectDraftService.confirmDraft ────────────────────────────────────────

test("confirmDraft updates status to confirmed", async () => {
  const stored: Record<string, unknown> = {
    id: "draft_001", tenantId: "t1", orgId: "o1", createdBy: "u1",
    status: "in_progress", categoryId: "electricidad", subcategoryId: "instalacion_elec",
    title: "Instalación eléctrica residencial", description: "Casa de 4 cuartos completa lista",
    city: "Miami", locationType: "on_site", budgetMin: null, budgetMax: null,
    urgency: "medium", completion: 85,
  };

  const prisma = {
    projectDraft: {
      async update({ data }: { where: unknown; data: Record<string, unknown> }) {
        return { ...stored, ...data };
      },
    },
  };

  const service = new ProjectDraftService(prisma as never);
  const result = await service.confirmDraft("draft_001", "t1");

  assert.equal(result.status, "confirmed");
  assert.equal(result.id, "draft_001");
});

// ── budget suggestion fields round-trip ─────────────────────────────────────

test("computeCompletion treats short title (< 5 chars) as incomplete", () => {
  const service = new ProjectDraftService({ projectDraft: {} } as never);
  const result = service.computeCompletion({
    categoryId: "pintura",
    subcategoryId: "interior",
    title: "OK",         // too short — should NOT score
    description: null,
    city: "Hialeah",
    locationType: null,
    budgetMin: null,
    budgetMax: null,
    urgency: null,
  });
  // categoryId(15) + subcategoryId(15) + city(20) = 50
  assert.equal(result, 50);
});

test("computeCompletion gives 15 pts only when both budgetMin AND budgetMax are set", () => {
  const service = new ProjectDraftService({ projectDraft: {} } as never);
  const withOnlyMin = service.computeCompletion({
    categoryId: null, subcategoryId: null, title: null, description: null,
    city: null, locationType: null, budgetMin: 500, budgetMax: null, urgency: null,
    attachmentsExpected: false,
  });
  const withBoth = service.computeCompletion({
    categoryId: null, subcategoryId: null, title: null, description: null,
    city: null, locationType: null, budgetMin: 500, budgetMax: 1500, urgency: null,
    attachmentsExpected: false,
  });
  assert.equal(withOnlyMin, 0);
  assert.equal(withBoth, 15);
});

// ── Fase 8: attachmentsExpected ──────────────────────────────────────────────

test("parseDraftBlock sets attachmentsExpected to true when present in JSON", () => {
  const text = `[DRAFT]
{"categoryId":"pintura","subcategoryId":"interior","title":null,"description":null,"city":null,"locationType":null,"budgetMin":null,"budgetMax":null,"urgency":null,"attachmentsExpected":true}
[/DRAFT]
Perfecto, agregaré fotos al proyecto.`;

  const result = parseDraftBlock(text);
  assert.notEqual(result, null);
  assert.equal(result?.attachmentsExpected, true);
});

test("parseDraftBlock defaults attachmentsExpected to false when absent", () => {
  const text = `[DRAFT]
{"categoryId":"electricidad","subcategoryId":null,"title":null,"description":null,"city":null,"locationType":null,"budgetMin":null,"budgetMax":null,"urgency":null}
[/DRAFT]`;

  const result = parseDraftBlock(text);
  assert.notEqual(result, null);
  assert.equal(result?.attachmentsExpected, false);
});

// ── Fase 9+10: markPublished ─────────────────────────────────────────────────

test("markPublished sets status to published and stores jobId", async () => {
  const stored: Record<string, unknown> = {
    id: "draft_002", tenantId: "t1", status: "confirmed", completion: 85,
    categoryId: "electricidad", subcategoryId: "instalacion_elec",
    title: "Instalación eléctrica residencial",
    description: "Casa de 4 cuartos con instalación nueva completa lista",
    city: "Miami", locationType: "on_site", budgetMin: 1000, budgetMax: 3000,
    urgency: "medium", attachmentsExpected: false, publishedJobId: null,
  };

  const prisma = {
    projectDraft: {
      async update({ data }: { where: unknown; data: Record<string, unknown> }) {
        return { ...stored, ...data };
      },
    },
  };

  const service = new ProjectDraftService(prisma as never);
  const result = await service.markPublished("draft_002", "t1", "job_abc123");

  assert.equal(result.status, "published");
  assert.equal(result.publishedJobId, "job_abc123");
});
