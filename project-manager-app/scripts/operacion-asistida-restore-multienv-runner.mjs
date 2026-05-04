import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const now = new Date();
const stamp = now.toISOString().replaceAll(":", "").replaceAll(".", "").replace("T", "_").replace("Z", "Z");
const evidenceDir = process.env.SEMSE_BCP_EVIDENCE_DIR ?? join("docs", "bcp", "evidence");
const latestPath = join(evidenceDir, "restore-multienv-latest.json");
const historicalPath = join(evidenceDir, `restore-multienv-${stamp}.json`);

const environments = [
  {
    name: process.env.SEMSE_BCP_PRIMARY_ENV_NAME ?? "primary",
    port: String(process.env.SEMSE_BCP_PRIMARY_PORT ?? 4140),
    latestReportPath: join(evidenceDir, "operacion-asistida-bcp-drill-api-primary-latest.json"),
    restoreLatestPath: join(evidenceDir, "restore-simulation-primary-latest.json")
  },
  {
    name: process.env.SEMSE_BCP_RECOVERY_ENV_NAME ?? "recovery",
    port: String(process.env.SEMSE_BCP_RECOVERY_PORT ?? 4141),
    latestReportPath: join(evidenceDir, "operacion-asistida-bcp-drill-api-recovery-latest.json"),
    restoreLatestPath: join(evidenceDir, "restore-simulation-recovery-latest.json")
  }
];

async function main() {
  const results = [];

  for (const env of environments) {
    await runCommand("node", ["./scripts/operacion-asistida-api-drill-runner.mjs"], {
      ...process.env,
      SEMSE_API_DRILL_PORT: env.port,
      SEMSE_API_DRILL_ENV_NAME: env.name,
      SEMSE_BCP_REPORT_PATH: env.latestReportPath
    });

    const drillReport = JSON.parse(await readFile(join(process.cwd(), env.latestReportPath), "utf8"));
    const restoreSourcePath = drillReport.evidenceFiles.historical;

    await runCommand("node", ["./scripts/operacion-asistida-restore-simulation.mjs"], {
      ...process.env,
      SEMSE_BCP_RESTORE_SOURCE_PATH: restoreSourcePath,
      SEMSE_BCP_RESTORE_REPORT_PATH: env.restoreLatestPath
    });

    const restoreReport = JSON.parse(await readFile(join(process.cwd(), env.restoreLatestPath), "utf8"));
    results.push({
      environment: env.name,
      port: Number(env.port),
      drillReport,
      restoreReport
    });
  }

  const report = buildReport(results);
  await mkdir(dirname(join(process.cwd(), latestPath)), { recursive: true });
  await writeFile(join(process.cwd(), latestPath), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(join(process.cwd(), historicalPath), `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log("[drill:operacion-asistida:restore:multienv] success", {
    latest: latestPath,
    historical: historicalPath,
    environments: results.map((result) => result.environment),
    checks: report.checks.length
  });
}

function buildReport(results) {
  const checks = [];

  checks.push(check("all environments produced successful drill evidence", () => {
    assert.ok(results.every((result) => result.drillReport.checks.every((entry) => entry.status === "pass")));
  }));

  checks.push(check("all environments produced successful restore evidence", () => {
    assert.ok(results.every((result) => result.restoreReport.checks.every((entry) => entry.status === "pass")));
  }));

  checks.push(check("environment labels are distinct", () => {
    const names = new Set(results.map((result) => result.environment));
    assert.equal(names.size, results.length);
  }));

  checks.push(check("workspace ids are isolated per environment", () => {
    const workspaceIds = new Set(results.map((result) => result.drillReport.ids.workspaceId));
    assert.equal(workspaceIds.size, results.length);
  }));

  checks.push(check("correlation ids are isolated per environment", () => {
    const correlationIds = new Set(results.map((result) => result.drillReport.ids.correlationId));
    assert.equal(correlationIds.size, results.length);
  }));

  return {
    generatedAtIso: now.toISOString(),
    drill: "operacion_asistida_restore_multienv",
    environments: results.map((result) => ({
      name: result.environment,
      port: result.port,
      source: result.drillReport.evidenceFiles.historical,
      restoreSource: result.restoreReport.source?.path ?? null
    })),
    checks
  };
}

function check(name, assertion) {
  assertion();
  return { name, status: "pass" };
}

async function runCommand(command, args, env) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env,
      stdio: "inherit"
    });

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      try {
        assert.equal(signal, null, `${command} terminated by signal ${signal}`);
        assert.equal(code, 0, `${command} exited with code ${code}`);
        resolve();
      } catch (error) {
        reject(error);
      }
    });
  });
}

main().catch((error) => {
  console.error("[drill:operacion-asistida:restore:multienv] failed", error);
  process.exit(1);
});
