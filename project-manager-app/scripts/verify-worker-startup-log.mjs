#!/usr/bin/env node
/**
 * Procedencia en runtime del Worker (G-R06; mejora de C3).
 *
 * El Worker no tiene superficie HTTP. Al arrancar escribe un log JSON
 * `label: "startup"` con gitSha, deploymentId, environment e imageDigest
 * (apps/worker/src/main.mjs). Railway lo indexa como atributos. Este script
 * recibe por stdin la respuesta de la API GraphQL de Railway:
 *   query { deploymentLogs(deploymentId: $d, filter: "@label:startup", limit: 20)
 *           { timestamp attributes { key value } } }
 * y exige que algún log de arranque de ESE deployment informe el SHA esperado.
 *
 * Uso: ... | node scripts/verify-worker-startup-log.mjs --expect-sha=<sha> --deployment-id=<id>
 * Salida JSON {verdict: VERIFIED|MISMATCH|NO_STARTUP_LOG|INVALID, ...}.
 * Exit 0 solo con VERIFIED; 3 en cualquier otro caso (fail closed); 2 uso.
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const SHA = /^[0-9a-f]{40}$/;

function attr(entry, key) {
  const hit = (entry?.attributes ?? []).find((a) => a?.key === key);
  if (!hit) return undefined;
  try {
    return JSON.parse(hit.value);
  } catch {
    return hit.value;
  }
}

export function verifyStartupLogs({ response, expectSha, deploymentId }) {
  const expect = String(expectSha ?? "").toLowerCase();
  if (!SHA.test(expect) || !deploymentId) return { verdict: "INVALID", reason: "expect-sha o deployment-id inválidos" };
  if (response?.errors?.length) return { verdict: "INVALID", reason: `API de Railway: ${response.errors.map((e) => e.message).join("; ")}` };
  const logs = response?.data?.deploymentLogs;
  if (!Array.isArray(logs)) return { verdict: "INVALID", reason: "respuesta sin deploymentLogs" };
  const startups = logs.filter((e) => attr(e, "label") === "startup");
  if (!startups.length) return { verdict: "NO_STARTUP_LOG", reason: `sin log de arranque en ${deploymentId}` };
  const observed = startups.map((e) => ({
    timestamp: e.timestamp,
    gitSha: String(attr(e, "gitSha") ?? "unknown").toLowerCase(),
    deploymentId: attr(e, "deploymentId") ?? "unknown",
    environment: attr(e, "environment") ?? "unknown",
    imageDigest: attr(e, "imageDigest") ?? "unknown",
  }));
  const ok = observed.find((o) => o.gitSha === expect && o.deploymentId === deploymentId);
  if (ok) return { verdict: "VERIFIED", source: "runtime-log", observed: ok };
  return {
    verdict: "MISMATCH",
    reason: `el arranque informa ${observed.map((o) => `${o.gitSha}@${o.deploymentId}`).join(", ")}; se esperaba ${expect}@${deploymentId}`,
    observed,
  };
}

function arg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const expectSha = arg("expect-sha");
  const deploymentId = arg("deployment-id");
  if (!expectSha || !deploymentId) {
    console.error("uso: --expect-sha=<sha> --deployment-id=<id> < respuesta.json");
    process.exit(2);
  }
  let result;
  try {
    result = verifyStartupLogs({ response: JSON.parse(readFileSync(0, "utf8")), expectSha, deploymentId });
  } catch (err) {
    result = { verdict: "INVALID", reason: `entrada no válida: ${String(err?.message ?? err)}` };
  }
  process.stdout.write(JSON.stringify(result) + "\n");
  process.exit(result.verdict === "VERIFIED" ? 0 : 3);
}
