import test from "node:test";
import assert from "node:assert/strict";
import { buildFallbackAnswer, buildSearchSnippet, chunkText, extractSearchTokens } from "../../apps/api/src/modules/prometeo/prometeo.retrieval.ts";

test("chunkText splits long text into bounded chunks", () => {
  const content = [
    "Primera sección con contexto de alcance, presupuesto y coordinación de proyecto.",
    "Segunda sección con evidencia operativa, riesgos abiertos y entregables pendientes.",
    "Tercera sección con validaciones de calidad, incidencias y próximos pasos del equipo."
  ].join("\n\n").repeat(8);

  const chunks = chunkText(content, { maxChars: 260, minChars: 120 });

  assert.ok(chunks.length >= 3);
  assert.equal(chunks.every((chunk) => chunk.text.length <= 260), true);
  assert.equal(chunks.every((chunk) => chunk.tokenCount > 0), true);
});

test("extractSearchTokens normalizes accents and punctuation", () => {
  const tokens = extractSearchTokens("¿Escrow final, liberación y revisión técnica?");
  assert.deepEqual(tokens, ["escrow", "final", "liberacion", "revision", "tecnica"]);
});

test("buildSearchSnippet centers the visible excerpt around the query", () => {
  const text = "Inicio irrelevante. La liberación final del escrow depende de la aprobación del último hito y del acta de cierre. Texto extra.";
  const snippet = buildSearchSnippet(text, "escrow hito", 80);

  assert.equal(snippet.includes("escrow"), true);
  assert.equal(snippet.length <= 86, true);
});

test("buildFallbackAnswer includes ranked fragments when llm is unavailable", () => {
  const answer = buildFallbackAnswer("estado del escrow", [
    {
      id: "chk_1",
      documentId: "doc_1",
      chunkIndex: 0,
      text: "El escrow final sigue retenido hasta que se apruebe el hito de cierre.",
      tokenCount: 15,
      metadata: undefined,
      createdAt: new Date().toISOString(),
      documentTitle: "Acta de pagos",
      sourceType: "contract",
      projectId: "prj_1",
      orgId: "org_1",
      score: 0.9
    }
  ]);

  assert.equal(answer.includes("Acta de pagos"), true);
  assert.equal(answer.includes("escrow"), true);
});
