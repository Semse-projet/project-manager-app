// G-R06 (unit): el Worker solo cuenta como verificado en runtime si su log de
// arranque del deployment esperado informa el SHA esperado.
import test from "node:test";
import assert from "node:assert/strict";
import { verifyStartupLogs } from "../../scripts/verify-worker-startup-log.mjs";

const SHA = "f6e1ad71f8ecdd0237f2835b325bd2f02585c9e6";
const DEP = "f15e858b-e161-408f-9251-0924a9563598";
const log = (sha, dep, label = "startup") => ({
  timestamp: "2026-11-27T13:35:13Z",
  attributes: [
    { key: "label", value: JSON.stringify(label) },
    { key: "gitSha", value: JSON.stringify(sha) },
    { key: "deploymentId", value: JSON.stringify(dep) },
    { key: "imageDigest", value: '"unknown"' },
  ],
});
const resp = (...logs) => ({ data: { deploymentLogs: logs } });

test("log de arranque con SHA y deployment esperados -> VERIFIED", () => {
  const r = verifyStartupLogs({ response: resp(log(SHA, DEP)), expectSha: SHA, deploymentId: DEP });
  assert.equal(r.verdict, "VERIFIED");
  assert.equal(r.source, "runtime-log");
});

test("SHA distinto -> MISMATCH", () => {
  assert.equal(verifyStartupLogs({ response: resp(log("a".repeat(40), DEP)), expectSha: SHA, deploymentId: DEP }).verdict, "MISMATCH");
});

test("deployment distinto -> MISMATCH", () => {
  assert.equal(verifyStartupLogs({ response: resp(log(SHA, "otro")), expectSha: SHA, deploymentId: DEP }).verdict, "MISMATCH");
});

test("sin log de arranque -> NO_STARTUP_LOG", () => {
  assert.equal(verifyStartupLogs({ response: resp(log(SHA, DEP, "sweep")), expectSha: SHA, deploymentId: DEP }).verdict, "NO_STARTUP_LOG");
  assert.equal(verifyStartupLogs({ response: resp(), expectSha: SHA, deploymentId: DEP }).verdict, "NO_STARTUP_LOG");
});

test("errores de API o entrada inválida -> INVALID", () => {
  assert.equal(verifyStartupLogs({ response: { errors: [{ message: "Not Authorized" }] }, expectSha: SHA, deploymentId: DEP }).verdict, "INVALID");
  assert.equal(verifyStartupLogs({ response: {}, expectSha: SHA, deploymentId: DEP }).verdict, "INVALID");
  assert.equal(verifyStartupLogs({ response: resp(log(SHA, DEP)), expectSha: "abc", deploymentId: DEP }).verdict, "INVALID");
});
