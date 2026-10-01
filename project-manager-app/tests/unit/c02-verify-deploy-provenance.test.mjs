import test from "node:test";
import assert from "node:assert/strict";
import { evaluateProvenance } from "../../scripts/verify-deploy-provenance.mjs";

const good = { gitSha: "754030f787c9d8abab6a965889b30cbb8c60175f", deploymentId: "d1", environment: "production", imageDigest: "sha256:abc" };

test("coincide con sha completo o abreviado", () => {
  assert.equal(evaluateProvenance(good, { expectSha: "754030f" }).ok, true);
  assert.equal(evaluateProvenance(good, { expectSha: good.gitSha }).ok, true);
});
test("sha distinto => falla", () => {
  const r = evaluateProvenance(good, { expectSha: "aecbd8d" });
  assert.equal(r.ok, false);
  assert.match(r.problems[0], /esperado/);
});
test("unknown nunca pasa; digest solo con --allow-unknown-digest", () => {
  const u = { ...good, gitSha: "unknown", deploymentId: "unknown" };
  assert.equal(evaluateProvenance(u, { expectSha: "754030f" }).problems.length, 2);
  const d = { ...good, imageDigest: "unknown" };
  assert.equal(evaluateProvenance(d, { expectSha: "754030f" }).ok, false);
  assert.equal(evaluateProvenance(d, { expectSha: "754030f", allowUnknownDigest: true }).ok, true);
});
