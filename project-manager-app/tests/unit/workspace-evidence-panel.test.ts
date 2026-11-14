import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  DIRECT_EVIDENCE_UPLOAD_LIMIT, evidenceStatus, evidenceStatusLabel,
  filterEvidence, resolveAccessibleJobId, evidenceUploadHref,
  uploadRealEvidenceFile, uploadEvidenceBatch,
  type EvidenceUploadTransport,
} from "../../apps/web/app/workspace/lib/evidence-model.ts";

const rows = [
  { id: "photo", kind: "PHOTO", validationStatus: "manual_review", milestoneId: "m1" },
  { id: "video", kind: "VIDEO", validationStatus: "passed", milestoneId: "m2" },
  { id: "doc", kind: "DOCUMENT", validationStatus: "pending" },
];

test("filtros locales combinan tipo, estado canónico e hito sin mutar datos", () => {
  assert.deepEqual(filterEvidence(rows, { kind: "PHOTO", status: "manual_review", milestoneId: "m1" }), [rows[0]]);
  assert.deepEqual(filterEvidence(rows, { kind: "VIDEO", status: "manual_review", milestoneId: "" }), []);
  assert.deepEqual(filterEvidence(rows, { kind: "", status: "", milestoneId: "__none__" }), [rows[2]]);
  assert.equal(filterEvidence(rows, { kind: "", status: "", milestoneId: "" }).length, 3);
  assert.equal(rows.length, 3);
});

test("manual_review es explícito; estado ausente/desconocido no es pendiente inventado", () => {
  assert.equal(evidenceStatusLabel(evidenceStatus(rows[0])), "Revisión manual");
  assert.equal(evidenceStatus({}), "unknown");
  assert.equal(evidenceStatusLabel("new_state"), "Estado: new_state");
  assert.equal(evidenceStatus({ validationStatus: "MANUAL-REVIEW", status: "passed" }), "manual_review");
});

test("jobId de query solo selecciona un trabajo devuelto por la lista accesible", () => {
  const jobs = [{ id: "allowed" }];
  assert.equal(resolveAccessibleJobId(jobs, "allowed"), "allowed");
  assert.equal(resolveAccessibleJobId(jobs, "foreign"), "");
  assert.equal(resolveAccessibleJobId(jobs, ""), "allowed");
  assert.equal(resolveAccessibleJobId([], "allowed"), "");
});

test("links de carga codifican Job.id y rol null no ofrece enlace operativo", () => {
  assert.equal(evidenceUploadHref(null, "job"), null);
  assert.equal(evidenceUploadHref("worker", "a/b?c"), "/worker/evidence?jobId=a%2Fb%3Fc");
  assert.equal(evidenceUploadHref("client", "a/b"), "/jobs/a%2Fb/evidence");
  assert.equal(evidenceUploadHref("admin", "job"), "/jobs/job/evidence");
  assert.equal(evidenceUploadHref("worker", ""), null);
});

function fixture(strategy: string = "single_put", putFails = false) {
  const calls: string[] = [];
  let sent: File | null = null;
  const transport: EvidenceUploadTransport = {
    plan: async (input: Record<string, unknown>) => {
      calls.push("plan");
      assert.equal(input.fileSizeBytes, 4);
      return { key: "tenants/test/file", recommendedStrategy: strategy, maxSingleUploadBytes: DIRECT_EVIDENCE_UPLOAD_LIMIT };
    },
    put: async (key: string, file: File) => {
      calls.push("bytes"); sent = file;
      assert.equal(key, "tenants/test/file");
      if (putFails) throw new Error("PUT 403");
    },
    register: async (jobId: string, input: Record<string, unknown>) => {
      calls.push("register");
      assert.equal(jobId, "a%2Fb");
      assert.equal(input.filename, "test.txt");
      return { id: "evidence", ...input };
    },
  };
  return { calls, transport, sent: () => sent };
}

test("flujo real exige plan → mismo File con bytes → registro", async () => {
  const file = new File(["real"], "test.txt", { type: "text/plain" });
  const f = fixture();
  await uploadRealEvidenceFile(file, { jobId: "a/b" }, f.transport);
  assert.deepEqual(f.calls, ["plan", "bytes", "register"]);
  assert.equal(f.sent(), file);
  assert.equal(await f.sent()!.text(), "real");
});

test("external_transfer y estrategias no conocidas no envían bytes ni registran keys", async () => {
  for (const strategy of ["external_transfer", "multipart", "unknown", ""]) {
    const f = fixture(strategy);
    await assert.rejects(uploadRealEvidenceFile(new File(["real"], "test.txt"), { jobId: "job" }, f.transport), /transferencia|estrategia/i);
    assert.deepEqual(f.calls, ["plan"]);
  }
});

test("rechaza simulación de archivo, archivo vacío, grande y falta de trabajo antes del plan", async () => {
  const f = fixture();
  await assert.rejects(uploadRealEvidenceFile({ name: "fake", size: 4, key: "fake" } as unknown as File, { jobId: "job" }, f.transport), /archivo real/i);
  await assert.rejects(uploadRealEvidenceFile(new File([], "empty"), { jobId: "job" }, f.transport), /vacío/i);
  const large = new File([new Uint8Array(DIRECT_EVIDENCE_UPLOAD_LIMIT + 1)], "large");
  await assert.rejects(uploadRealEvidenceFile(large, { jobId: "job" }, f.transport), /25 MiB/i);
  await assert.rejects(uploadRealEvidenceFile(new File(["real"], "test.txt"), { jobId: "" }, f.transport), /trabajo/i);
  assert.deepEqual(f.calls, []);
});

test("fallo PUT nunca registra evidencia", async () => {
  const f = fixture("single_put", true);
  await assert.rejects(uploadRealEvidenceFile(new File(["real"], "test.txt"), { jobId: "job" }, f.transport), /PUT 403/);
  assert.deepEqual(f.calls, ["plan", "bytes"]);
});

test("respeta un límite del servidor más estricto y rechaza planes sin key", async () => {
  for (const plan of [
    { recommendedStrategy: "single_put", key: "valid", maxSingleUploadBytes: 3 },
    { recommendedStrategy: "single_put", maxSingleUploadBytes: DIRECT_EVIDENCE_UPLOAD_LIMIT },
  ]) {
    const f = fixture();
    f.transport.plan = async () => { f.calls.push("plan"); return plan; };
    await assert.rejects(uploadRealEvidenceFile(new File(["real"], "test.txt"), { jobId: "job" }, f.transport), /límite|almacenamiento/);
    assert.deepEqual(f.calls, ["plan"]);
  }
});

test("registra metadata declarada e hito sin cambiar bytes ni inventar coordenadas", async () => {
  const f = fixture();
  const metadata = { fieldCapture: { zoneLabel: "Zona sintética", trust: "CLAIMED_BY_WORKER" } };
  f.transport.register = async (jobId, input) => {
    f.calls.push("register");
    assert.equal(jobId, "job");
    assert.equal(input.milestoneId, "m1");
    assert.equal(input.kind, "PHOTO");
    assert.equal(input.metadata, metadata);
    assert.equal("geoLat" in input, false);
    return { id: "registered", ...input };
  };
  await uploadRealEvidenceFile(new File(["real"], "test.txt"), { jobId: "job", milestoneId: "m1", kind: "PHOTO", metadata }, f.transport);
  assert.deepEqual(f.calls, ["plan", "bytes", "register"]);
});

test("lote conserva resultados por archivo y continúa tras fallo parcial", async () => {
  const files = [new File(["one"], "ok.txt"), new File(["two"], "fail.txt"), new File(["three"], "also-ok.txt")];
  const results = await uploadEvidenceBatch(files, async (file) => {
    if (file.name === "fail.txt") throw new Error("403 acceso denegado");
  });
  assert.deepEqual(results.map((result) => result.ok), [true, false, true]);
  assert.equal(results[1].error, "403 acceso denegado");
  assert.equal(results[1].file, files[1]);
});

test("contrato UI mantiene rol null cerrado, queries estables y recorrido exclusivamente local", () => {
  const source = readFileSync(new URL("../../apps/web/app/workspace/components/EvidencePanel.tsx", import.meta.url), "utf8");
  assert.match(source, /role: WorkspaceRole \| null/);
  assert.match(source, /role \? `evidence-jobs/);
  assert.match(source, /useCallback/);
  assert.match(source, /PanelState/);
  assert.match(source, /manual_review/);
  assert.match(source, /\/workspace\/recorridos-360/);
});

test("página jobs elimina datos declarados y bytes sintéticos, conserva listado", () => {
  const source = readFileSync(new URL("../../apps/web/app/jobs/[jobId]/evidence/page.tsx", import.meta.url), "utf8");
  assert.match(source, /type="file"/);
  assert.match(source, /uploadRealEvidenceFile/);
  assert.match(source, /fetchJobEvidence/);
  assert.doesNotMatch(source, /new Uint8Array|new Blob|fileSizeMb|createMultipartUploadSession|handleCompleteMultipart/);
});

test("hub worker muestra errores trabajos/hitos y fallos por archivo", () => {
  const source = readFileSync(new URL("../../apps/web/app/(app)/worker/evidence/page.tsx", import.meta.url), "utf8");
  assert.match(source, /resolveAccessibleJobId/);
  assert.match(source, /searchParams.get\("jobId"\)/);
  assert.match(source, /jobsQuery.error/);
  assert.match(source, /milestonesQuery.error/);
  assert.match(source, /uploadEvidenceBatch/);
  assert.doesNotMatch(source, /fetchJobMilestones\(jobId\)\.catch\(\(\) => \[\]\)/);
});
