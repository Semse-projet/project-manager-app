import test from "node:test";
import assert from "node:assert/strict";
import {
  anatomyNodeSchema,
  anatomyQuerySchema,
  anatomyRelationSchema
} from "@semse/schemas";
import {
  getAnatomyKnowledgeBase,
  loadAnatomySeed
} from "@semse/knowledge";
import { runAnatomyTutorAgent } from "@semse/agents/anatomy";

test("anatomy seed validates against canonical schemas", async () => {
  const seed = await loadAnatomySeed();

  assert.equal(seed.namespace, "anatomy.human");
  assert.ok(seed.nodes.length >= 10);
  assert.ok(seed.relations.length >= 5);

  for (const node of seed.nodes) {
    assert.equal(anatomyNodeSchema.parse(node).id, node.id);
  }

  for (const relation of seed.relations) {
    assert.equal(anatomyRelationSchema.parse(relation).id, relation.id);
  }
});

test("anatomy knowledge base resolves hierarchy and relationships", async () => {
  const knowledgeBase = await getAnatomyKnowledgeBase();

  assert.deepEqual(
    knowledgeBase.getPathToRoot("tongue").map((node) => node.id),
    ["body", "head", "face", "mouth", "tongue"]
  );

  assert.deepEqual(
    knowledgeBase.getChildren("mouth").map((node) => node.id),
    ["tongue", "teeth", "epithelial_tissue"]
  );

  assert.equal(knowledgeBase.validate().valid, true);
});

test("anatomy query schema accepts structured tutor lookup", () => {
  const parsed = anatomyQuerySchema.parse({
    search: "mouth",
    includeRelations: true,
    includePath: true,
    maxDepth: 4
  });

  assert.equal(parsed.search, "mouth");
  assert.equal(parsed.includePath, true);
});

test("anatomy tutor resolves the target node inside natural-language queries", async () => {
  const result = await runAnatomyTutorAgent({
    question: "ruta desde cuerpo hasta lengua"
  });

  assert.equal(result.node?.id, "tongue");
  assert.deepEqual(
    result.path.map((node) => node.id),
    ["body", "head", "face", "mouth", "tongue"]
  );
});

test("anatomy tutor explains conceptual differences between node kinds", async () => {
  const result = await runAnatomyTutorAgent({
    question: "diferencia entre region y unidad funcional"
  });

  assert.match(result.answer, /region/i);
  assert.match(result.answer, /functional_unit|unidad funcional/i);
  assert.equal(result.node, null);
});
