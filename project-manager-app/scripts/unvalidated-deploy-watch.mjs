#!/usr/bin/env node
/**
 * Una ronda de observación de procedencia para la alarma de despliegue no
 * validado (propuesta C4, incidente 9e2f87f1). Consulta TODOS los objetivos y
 * devuelve todos los que sirven el SHA vigilado; no se detiene en el primero
 * (la versión anterior de la alarma solo informó de semse-API aunque los cuatro
 * servicios sirvieron 9e2f87f1).
 *
 * Uso:
 *   node scripts/unvalidated-deploy-watch.mjs --sha=<40hex> \
 *     --target="semse-API|https://...|/v1/health" --target="semse-web|https://...|/api/semse/healthz"
 * Salida (stdout, JSON): { sha, hits: [label...], observations: [{label, gitSha, status}] }
 * Exit 0 siempre que la ronda se complete (la decisión la toma el workflow);
 * 2 en uso incorrecto.
 */
import { pathToFileURL } from "node:url";
import { evaluateProvenance } from "./verify-deploy-provenance.mjs";

const SHA = /^[0-9a-f]{40}$/;

export function parseTarget(raw) {
  const [label, base, path] = String(raw).split("|");
  if (!label || !base || !path) throw new Error(`objetivo inválido: '${raw}'`);
  return { label, base: base.replace(/\/+$/, ""), path };
}

/** Extrae gitSha con la misma lectura que el verificador C02 (una sola fuente). */
export function extractGitSha(body) {
  const v = evaluateProvenance(body, {}).observed.gitSha;
  return typeof v === "string" && v && v !== "unknown" ? v.toLowerCase() : "unknown";
}

export function aggregate(sha, observations) {
  const want = String(sha).toLowerCase();
  return { sha: want, hits: observations.filter((o) => o.gitSha === want).map((o) => o.label), observations };
}

export async function observe(target, { timeoutMs = 5000, fetchImpl = fetch } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${target.base}${target.path}`, { signal: ctrl.signal, headers: { accept: "application/json" } });
    let body = null;
    try { body = await res.json(); } catch { body = null; }
    return { label: target.label, status: res.status, gitSha: extractGitSha(body) };
  } catch (err) {
    return { label: target.label, status: 0, gitSha: "unknown", error: String(err?.message ?? err) };
  } finally {
    clearTimeout(t);
  }
}

export async function round(sha, targets, opts) {
  const observations = await Promise.all(targets.map((t) => observe(t, opts)));
  return aggregate(sha, observations);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const sha = (process.argv.find((a) => a.startsWith("--sha=")) ?? "").slice(6).toLowerCase();
  const targets = process.argv.filter((a) => a.startsWith("--target=")).map((a) => parseTarget(a.slice(9)));
  if (!SHA.test(sha) || targets.length === 0) {
    console.error('uso: --sha=<40hex> --target="label|base|path" [...]');
    process.exit(2);
  }
  const result = await round(sha, targets);
  process.stdout.write(JSON.stringify(result) + "\n");
}
