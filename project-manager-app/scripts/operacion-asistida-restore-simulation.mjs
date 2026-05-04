import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const now = new Date();
const stamp = now.toISOString().replaceAll(":", "").replaceAll(".", "").replace("T", "_").replace("Z", "Z");
const evidenceDir = process.env.SEMSE_BCP_EVIDENCE_DIR ?? join("docs", "bcp", "evidence");
const manifestPath = process.env.SEMSE_BCP_MANIFEST_PATH ?? join(evidenceDir, "manifest.json");
const latestPath = process.env.SEMSE_BCP_RESTORE_REPORT_PATH ?? join(evidenceDir, "restore-simulation-latest.json");

async function main() {
  const manifest = JSON.parse(await readFile(join(process.cwd(), manifestPath), "utf8"));
  const sourceRelativePath = process.env.SEMSE_BCP_RESTORE_SOURCE_PATH ?? manifest.latest?.evidenceFiles?.historical ?? manifest.latest?.evidenceFiles?.latest;
  assert.ok(sourceRelativePath, "No restore source path could be resolved from manifest.");

  const sourceReport = JSON.parse(await readFile(join(process.cwd(), sourceRelativePath), "utf8"));
  const restoreReport = buildRestoreReport(sourceRelativePath, sourceReport);
  const historicalPath = join(evidenceDir, `restore-simulation-${sourceReport.mode}-${stamp}.json`);

  await mkdir(dirname(join(process.cwd(), latestPath)), { recursive: true });
  await writeFile(join(process.cwd(), latestPath), `${JSON.stringify(restoreReport, null, 2)}\n`, "utf8");
  await writeFile(join(process.cwd(), historicalPath), `${JSON.stringify(restoreReport, null, 2)}\n`, "utf8");

  console.log("[drill:operacion-asistida:restore] success", {
    source: sourceRelativePath,
    latest: latestPath,
    historical: historicalPath,
    checks: restoreReport.checks.length
  });
}

function buildRestoreReport(sourceRelativePath, sourceReport) {
  const checks = [];
  const evidence = sourceReport.evidence ?? {};

  checks.push(check("source report has correlationId", () => {
    assert.equal(typeof sourceReport.ids?.correlationId, "string");
    assert.ok(sourceReport.ids.correlationId.length > 0);
  }));

  checks.push(check("source report has workspaceId", () => {
    assert.equal(typeof sourceReport.ids?.workspaceId, "string");
    assert.ok(sourceReport.ids.workspaceId.length > 0);
  }));

  if (sourceReport.mode === "local") {
    checks.push(check("local restore can reconstruct operatorContext", () => {
      assert.equal(evidence.operatorContext.workspaceId, sourceReport.ids.workspaceId);
      assert.equal(evidence.operatorContext.correlationId, sourceReport.ids.correlationId);
    }));
    checks.push(check("local restore can reconstruct workspaceMemory and trace", () => {
      assert.equal(evidence.workspaceMemory.workspaceId, sourceReport.ids.workspaceId);
      assert.equal(evidence.trace.correlationId, sourceReport.ids.correlationId);
    }));
  }

  if (sourceReport.mode === "api") {
    checks.push(check("api restore preserves run creation evidence", () => {
      assert.equal(evidence.created.input.operatorContext.workspaceId, sourceReport.ids.workspaceId);
      assert.equal(evidence.created.correlationId, sourceReport.ids.correlationId);
    }));
    checks.push(check("api restore preserves ops trace evidence", () => {
      assert.ok(evidence.trace.runs.some((run) => run.operatorContext.workspaceId === sourceReport.ids.workspaceId));
      assert.ok(evidence.workspaceMemory.items.some((memory) => memory.workspaceId === sourceReport.ids.workspaceId));
    }));
  }

  checks.push(check("restore source keeps successful checks", () => {
    assert.ok(Array.isArray(sourceReport.checks));
    assert.ok(sourceReport.checks.every((entry) => entry.status === "pass"));
  }));

  return {
    generatedAtIso: now.toISOString(),
    drill: "operacion_asistida_restore_simulation",
    source: {
      path: sourceRelativePath,
      mode: sourceReport.mode,
      generatedAtIso: sourceReport.generatedAtIso
    },
    checks,
    reconstructed: {
      workspaceId: sourceReport.ids.workspaceId,
      correlationId: sourceReport.ids.correlationId,
      tenantId: sourceReport.tenantId,
      mode: sourceReport.mode
    }
  };
}

function check(name, assertion) {
  assertion();
  return { name, status: "pass" };
}

main().catch((error) => {
  console.error("[drill:operacion-asistida:restore] failed", error);
  process.exit(1);
});
