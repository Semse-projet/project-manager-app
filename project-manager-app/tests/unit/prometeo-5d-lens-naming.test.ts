import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";

// Pins the prompt-level mitigation for audit finding 1.11b: the model once
// paraphrased the tenant-level Ecosystem 5D "Trust" score as a system-wide
// "nivel de confianza del sistema". The label and the naming rule must stay.
const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const read = (relative: string) => readFileSync(path.join(repoRoot, relative), "utf8");

const orchestrator = read("apps/api/src/modules/ai-models/orchestrator/prometeo-orchestrator.service.ts");
const contextService = read("apps/api/src/modules/ai-models/context/operational-context.service.ts");

const HEADER = "Lente Ecosistema 5D (nivel proyecto/tenant — no es una métrica global del sistema)";

test("both context generators label the 5D block as project/tenant scoped", () => {
  assert.ok(orchestrator.includes(HEADER), "prometeo-orchestrator.service.ts must keep the scoped 5D header");
  assert.ok(contextService.includes(HEADER), "operational-context.service.ts must keep the scoped 5D header");
});

test("the system prompt forbids renaming the 5D dimensions or presenting them as global", () => {
  assert.match(orchestrator, /REGLA SOBRE EL LENTE ECOSISTEMA 5D/);
  assert.match(orchestrator, /nunca inventes un nombre distinto/);
  assert.match(orchestrator, /confianza del sistema/);
  assert.match(orchestrator, /no .* métrica de toda la plataforma|ni la presentes como si fuera una métrica de toda la plataforma/);
});

test("the 5D block keeps real dimension names and scores from the service", () => {
  assert.match(orchestrator, /ctx\.ecosystem5d\.score\}\/100/);
  assert.match(orchestrator, /dim\.label\}: \*\*\$\{dim\.score\}\/100/);
});
