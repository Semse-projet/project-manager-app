import test from "node:test";
import assert from "node:assert/strict";
import { buildCanonicalProjectView } from "../../apps/web/lib/canonical-project-view.ts";

test("builds a canonical project view from project and job data", () => {
  assert.deepEqual(
    buildCanonicalProjectView(
      { id: "project-1", tenantId: "tenant-1", jobId: "job-1" },
      { title: "Kitchen repair", scope: "Replace the leaking pipe", category: "plumbing", location: "Austin", budgetMax: 1200 },
    ),
    {
      id: "project-1",
      tenantId: "tenant-1",
      jobId: "job-1",
      canonicalProjectId: "project-1",
      title: "Kitchen repair",
      description: "Replace the leaking pipe",
      trade: "plumbing",
      location: "Austin",
      budgetEstimate: 1200,
    },
  );
});

test("uses the minimum budget when the maximum is absent", () => {
  const view = buildCanonicalProjectView(
    { id: "project-2", tenantId: "tenant-2" },
    { budgetMin: 450 },
  );
  assert.equal(view?.budgetEstimate, 450);
  assert.equal(view?.title, "Proyecto");
  assert.equal(view?.trade, "—");
});

test("rejects malformed project records", () => {
  assert.equal(buildCanonicalProjectView(null, null), null);
  assert.equal(buildCanonicalProjectView({ tenantId: "tenant-1" }, null), null);
});

test("preserves a zero maximum budget instead of replacing it with the minimum", () => {
  const view = buildCanonicalProjectView({ id: "project-zero" }, { budgetMax: 0, budgetMin: 100 });
  assert.equal(view?.budgetEstimate, 0);
});

test("leaves unavailable job data empty without inventing a budget", () => {
  const view = buildCanonicalProjectView({ id: "project-no-job", jobId: "job-unavailable" }, null);
  assert.equal(view?.jobId, "job-unavailable");
  assert.equal(view?.description, null);
  assert.equal(view?.budgetEstimate, null);
  assert.equal(view?.location, "—");
});
