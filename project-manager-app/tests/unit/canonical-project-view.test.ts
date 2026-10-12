import test from "node:test";
import assert from "node:assert/strict";
import { buildCanonicalProjectView } from "../../apps/web/lib/canonical-project-view.ts";

test("usa los datos del trabajo para título, oficio, ubicación y presupuesto", () => {
  const view = buildCanonicalProjectView(
    { id: "proj_1", tenantId: "t1", jobId: "job_1" },
    { title: "Pintura exterior", category: "pintura", scope: "Cinco pisos", location: "Miami", budgetMin: 1000, budgetMax: 2500 },
  );
  assert.equal(view?.title, "Pintura exterior");
  assert.equal(view?.trade, "pintura");
  assert.equal(view?.location, "Miami");
  assert.equal(view?.description, "Cinco pisos");
  assert.equal(view?.budgetEstimate, 2500);
  assert.equal(view?.canonicalProjectId, "proj_1");
});

test("sin trabajo deja valores neutros y usa presupuesto mínimo si no hay máximo", () => {
  const bare = buildCanonicalProjectView({ id: "proj_2" }, null);
  assert.equal(bare?.title, "Proyecto");
  assert.equal(bare?.trade, "—");
  assert.equal(bare?.budgetEstimate, null);
  assert.equal(buildCanonicalProjectView({ id: "proj_3" }, { budgetMin: 400 })?.budgetEstimate, 400);
});

test("sin id de proyecto no hay vista", () => {
  assert.equal(buildCanonicalProjectView({}, { title: "x" }), null);
  assert.equal(buildCanonicalProjectView(null, null), null);
});
