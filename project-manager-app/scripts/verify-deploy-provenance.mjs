#!/usr/bin/env node
/**
 * C02 — Verifica que lo que corre en un entorno es el commit esperado.
 *
 *   node scripts/verify-deploy-provenance.mjs --url=<base API> --expect-sha=<sha> [--allow-unknown-digest]
 *
 * Lee `GET {url}/v1/health` (campos gitSha/deploymentId/environment/imageDigest de
 * @semse/shared deploy-provenance) y falla (exit 1) si el sha no coincide o si
 * algun campo es "unknown" (el digest solo se tolera con --allow-unknown-digest,
 * porque Railway no lo expone). Solo lectura. Nunca fabrica valores.
 */
export function evaluateProvenance(health, { expectSha, allowUnknownDigest = false }) {
  const p = health?.provenance ?? health?.deploy ?? health ?? {};
  const problems = [];
  const sha = String(p.gitSha ?? "unknown");
  if (sha === "unknown") problems.push("gitSha desconocido (deploy fuera de Git o sin RAILWAY_GIT_COMMIT_SHA)");
  else if (expectSha && !(sha.startsWith(expectSha) || expectSha.startsWith(sha))) {
    problems.push(`gitSha ${sha} != esperado ${expectSha}`);
  }
  for (const f of ["deploymentId", "environment"]) {
    if (String(p[f] ?? "unknown") === "unknown") problems.push(`${f} desconocido`);
  }
  if (!allowUnknownDigest && String(p.imageDigest ?? "unknown") === "unknown") problems.push("imageDigest desconocido");
  return { ok: problems.length === 0, problems, observed: { gitSha: sha, deploymentId: p.deploymentId, environment: p.environment, imageDigest: p.imageDigest } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")));
  if (!args.url || !args["expect-sha"]) {
    console.error("uso: --url=<base> --expect-sha=<sha> [--allow-unknown-digest]");
    process.exit(2);
  }
  const res = await fetch(`${args.url.replace(/\/+$/, "")}/v1/health`);
  const health = await res.json().catch(() => ({}));
  const r = evaluateProvenance(health, { expectSha: args["expect-sha"], allowUnknownDigest: "allow-unknown-digest" in args });
  console.log(JSON.stringify({ status: res.status, ...r }, null, 2));
  process.exit(res.ok && r.ok ? 0 : 1);
}
