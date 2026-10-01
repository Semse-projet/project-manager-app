#!/usr/bin/env node
/**
 * C02 — Verifica que lo que corre en un entorno es el commit esperado.
 *
 *   node scripts/verify-deploy-provenance.mjs --url=<base> --expect-sha=<sha> [--path=/v1/health] [--allow-unknown-digest]
 *        [--retries=N --interval=S] [--markdown]
 *
 * Lee `GET {url}/v1/health` (campos gitSha/deploymentId/environment/imageDigest de
 * @semse/shared deploy-provenance) y falla (exit 1) si el sha no coincide o si
 * algun campo es "unknown" (el digest solo se tolera con --allow-unknown-digest,
 * porque Railway no lo expone). Solo lectura. Nunca fabrica valores.
 */
export function evaluateProvenance(health, { expectSha, allowUnknownDigest = false }) {
  const p = health?.provenance ?? health?.deploy ?? health?.data ?? health ?? {};
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

export function toMarkdown(label, result, status) {
  const o = result.observed;
  const rows = [
    `### Procedencia en runtime — ${label}`,
    "",
    `| campo | valor |`,
    `|---|---|`,
    `| HTTP | ${status} |`,
    `| gitSha | \`${o.gitSha}\` |`,
    `| deploymentId | \`${o.deploymentId ?? "unknown"}\` |`,
    `| environment | \`${o.environment ?? "unknown"}\` |`,
    `| imageDigest | \`${o.imageDigest ?? "unknown"}\` |`,
    `| resultado | ${result.ok ? "✅ coincide" : "⚠️ " + result.problems.join("; ")} |`,
    "",
  ];
  return rows.join("\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, ...v] = a.replace(/^--/, "").split("="); return [k, v.length ? v.join("=") : "true"]; }));
  if (!args.url || !args["expect-sha"]) {
    console.error("uso: --url=<base> --expect-sha=<sha> [--path=/v1/health] [--allow-unknown-digest] [--retries=N --interval=S] [--markdown]");
    process.exit(2);
  }
  const url = `${args.url.replace(/\/+$/, "")}${args.path ?? "/v1/health"}`;
  const retries = Math.max(1, Number(args.retries ?? 1));
  const interval = Math.max(0, Number(args.interval ?? 10)) * 1000;
  let last = { status: 0, r: { ok: false, problems: ["sin respuesta"], observed: { gitSha: "unknown" } } };
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      const health = await res.json().catch(() => ({}));
      const r = evaluateProvenance(health, { expectSha: args["expect-sha"], allowUnknownDigest: "allow-unknown-digest" in args });
      last = { status: res.status, r };
      if (res.ok && r.ok) break;
    } catch (err) {
      last = { status: 0, r: { ok: false, problems: [`error de red: ${err instanceof Error ? err.message : err}`], observed: { gitSha: "unknown" } } };
    }
    if (attempt < retries) await new Promise((r) => setTimeout(r, interval));
  }
  console.log(args.markdown ? toMarkdown(args.label ?? url, last.r, last.status) : JSON.stringify({ status: last.status, ...last.r }, null, 2));
  process.exit(last.status >= 200 && last.status < 300 && last.r.ok ? 0 : 1);
}
