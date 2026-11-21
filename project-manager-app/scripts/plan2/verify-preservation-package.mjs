#!/usr/bin/env node
// Plan 2 — verificador reproducible del paquete de preservación (solo lectura).
//
// Qué hace:
//   1. Lee cada archivo del paquete UNA vez (modo 'r'), calcula SHA-256 sobre
//      esos mismos bytes y parsea desde ese buffer: hash y contenido analizado
//      corresponden a los mismos bytes.
//   2. Compara con el SHA-256 esperado, si se declara.
//   3. Comprueba que las exportaciones JSON declaradas como distintas sigan
//      separadas por hash (nunca se combinan ni deduplican).
//   4. Coteja IDs y duraciones JSON ↔ CSV fila por fila, sin modificar nada.
//   5. Separa filas sintéticas (se cuentan y preservan, nunca se suman como
//      trabajo) y suma la duración de las filas del propósito laboral indicado.
//   6. Re-verifica tamaño, mtime y hash al terminar: si un original cambió
//      durante la ejecución, el resultado es FAIL.
//
// Qué NO hace: no escribe junto a los originales, no corrige, no combina, no
// clasifica filas como horas laborales, no infiere vínculos con Evidence, no
// contacta servicios. Un hash igual demuestra igualdad de bytes, NO
// autenticidad del origen ni exactitud de las horas.
//
// Uso (desde project-manager-app/):
//   node scripts/plan2/verify-preservation-package.mjs --manifest <m.json> --out <reporte.json>
// El manifiesto describe rutas y campos; ver docs/program/plan-2/README.md.
import { createHash } from 'node:crypto';
import { open, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const TOOL_VERSION = '1.0.0';

export async function readOnce(file) {
  const fh = await open(file, 'r');
  try {
    const before = await fh.stat();
    const buf = await fh.readFile();
    return { buf, size: before.size, mtimeMs: before.mtimeMs, sha256: createHash('sha256').update(buf).digest('hex') };
  } finally {
    await fh.close();
  }
}

/** Parser CSV RFC 4180 mínimo (comillas dobles, CRLF/LF, comas en celdas). */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let i = 0;
  let quoted = false;
  if (text.charCodeAt(0) === 0xfeff) i = 1; // BOM
  for (; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  const nonEmpty = rows.filter((r) => !(r.length === 1 && r[0] === ''));
  const [header = [], ...body] = nonEmpty;
  return { header, records: body.map((r) => Object.fromEntries(header.map((h, k) => [h, r[k] ?? '']))) };
}

export function getPath(obj, dotted) {
  if (!dotted) return obj;
  return dotted.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

export function toSeconds(value, unit) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (unit === 'minutes') return n * 60;
  if (unit === 'hours') return n * 3600;
  if (unit === 'milliseconds') return n / 1000;
  return n; // seconds
}

/** Transformaciones por fila para contrastar hipótesis de redondeo; no corrigen datos. */
export function applyTransform(seconds, transform) {
  if (!transform) return seconds;
  if (transform === 'floorMinute') return Math.floor(seconds / 60) * 60;
  if (transform === 'roundMinute') return Math.round(seconds / 60) * 60;
  if (transform === 'roundHours2') return Math.round((seconds / 3600) * 100) * 36;
  throw new Error(`transform desconocida: ${transform}`);
}

function isSynthetic(record, marker) {
  if (!marker) return false;
  return String(getPath(record, marker.field)) === String(marker.value);
}

export async function verifyPackage(manifest, { baseDir = process.cwd() } = {}) {
  const findings = [];
  const fail = (code, detail) => findings.push({ level: 'FAIL', code, detail });
  const warn = (code, detail) => findings.push({ level: 'WARN', code, detail });

  const files = [];
  const parsed = new Map();
  for (const entry of manifest.files ?? []) {
    const abs = path.resolve(baseDir, entry.path);
    let snap;
    try { snap = await readOnce(abs); } catch (err) {
      fail('FILE_UNREADABLE', `${entry.role}: ${err.code ?? err.message}`);
      files.push({ role: entry.role, path: entry.path, status: 'UNREADABLE' });
      continue;
    }
    const rec = { role: entry.role, path: entry.path, bytes: snap.size, sha256: snap.sha256, expectedSha256: entry.expectedSha256 ?? null };
    if (entry.expectedSha256) {
      rec.hashMatches = entry.expectedSha256.toLowerCase() === snap.sha256;
      if (!rec.hashMatches) fail('HASH_MISMATCH', `${entry.role}: esperado ${entry.expectedSha256}, obtenido ${snap.sha256}`);
    }
    const kind = entry.kind ?? (entry.path.toLowerCase().endsWith('.csv') ? 'csv' : 'json');
    try {
      const text = snap.buf.toString('utf8');
      parsed.set(entry.role, kind === 'csv' ? { kind, ...parseCsv(text) } : { kind, data: JSON.parse(text) });
      rec.parse = 'OK';
    } catch (err) {
      rec.parse = 'ERROR';
      fail('PARSE_ERROR', `${entry.role}: ${err.message}`);
    }
    files.push(rec);
    entry.__snap = { abs, size: snap.size, mtimeMs: snap.mtimeMs, sha256: snap.sha256 };
  }

  // Separación de exportaciones: cada par declarado debe seguir con hashes distintos.
  for (const [a, b] of manifest.mustRemainDistinct ?? []) {
    const fa = files.find((f) => f.role === a);
    const fb = files.find((f) => f.role === b);
    if (!fa?.sha256 || !fb?.sha256) { fail('DISTINCT_PAIR_MISSING', `${a} / ${b}`); continue; }
    if (fa.sha256 === fb.sha256) fail('EXPORTS_NOT_DISTINCT', `${a} y ${b} tienen el mismo SHA-256: no son dos exportaciones distintas`);
  }

  // Registros JSON.
  const rc = manifest.records;
  let records = [];
  const summary = {};
  if (rc) {
    const src = parsed.get(rc.jsonRole);
    const list = src?.kind === 'json' ? getPath(src.data, rc.recordsPath) : undefined;
    if (!Array.isArray(list)) fail('RECORDS_NOT_ARRAY', `${rc.jsonRole}:${rc.recordsPath ?? '<raíz>'}`);
    else records = list;
    const ids = records.map((r) => String(getPath(r, rc.idField)));
    const dupIds = [...new Set(ids.filter((id, k) => ids.indexOf(id) !== k))];
    if (dupIds.length) warn('DUPLICATE_IDS_IN_JSON', `${dupIds.length} ID repetidos (no se deduplican)`);
    const synthetic = records.filter((r) => isSynthetic(r, rc.syntheticMarker));
    const labor = records.filter((r) => !isSynthetic(r, rc.syntheticMarker)
      && (!rc.laborPurpose || String(getPath(r, rc.purposeField)) === String(rc.laborPurpose)));
    const laborSeconds = labor.reduce((s, r) => s + (toSeconds(getPath(r, rc.durationField), rc.durationUnit) ?? 0), 0);
    Object.assign(summary, {
      jsonRecords: records.length,
      duplicateIds: dupIds.length,
      syntheticRecords: synthetic.length,
      syntheticPreserved: synthetic.length, // contados, nunca eliminados ni sumados
      laborPurpose: rc.laborPurpose ?? null,
      laborRecords: labor.length,
      laborSeconds,
    });
    // Sumas alternativas (p. ej. Σ durationMinutes·60, como hace la UI del
    // tracker, frente a Σ accumulatedSeconds). Sólo se informan: coincidir con
    // el total de interfaz es una hipótesis, no una causa demostrada.
    summary.alternativeSums = (rc.alternativeDurations ?? []).map((alt) => {
      const seconds = labor.reduce((s, r) => {
        const primary = toSeconds(getPath(r, alt.field), alt.unit);
        const fallback = alt.fallbackField ? toSeconds(getPath(r, alt.fallbackField), alt.fallbackUnit) : null;
        return s + applyTransform(primary ?? fallback ?? 0, alt.transform);
      }, 0);
      const out = { label: alt.label ?? alt.field, transform: alt.transform ?? null, seconds, minusPrimarySeconds: seconds - laborSeconds };
      if (manifest.expect?.uiTotalSeconds != null) out.uiMinusThisSeconds = manifest.expect.uiTotalSeconds - seconds;
      return out;
    });
    const exp = manifest.expect ?? {};
    if (exp.laborRecords != null && exp.laborRecords !== labor.length) fail('LABOR_COUNT_MISMATCH', `esperado ${exp.laborRecords}, obtenido ${labor.length}`);
    if (exp.syntheticRecords != null && exp.syntheticRecords !== synthetic.length) fail('SYNTHETIC_COUNT_MISMATCH', `esperado ${exp.syntheticRecords}, obtenido ${synthetic.length}`);
    if (exp.uiTotalSeconds != null) {
      summary.uiTotalSeconds = exp.uiTotalSeconds;
      summary.uiMinusLaborSeconds = exp.uiTotalSeconds - laborSeconds;
      if (summary.uiMinusLaborSeconds !== 0) {
        // Se informa; el verificador NO atribuye causa. Una explicación sólo
        // puede venir de evidencia externa registrada por el propietario.
        warn('UI_TOTAL_DIFFERS', `total de interfaz − suma ${rc.laborPurpose ?? 'filas'} = ${summary.uiMinusLaborSeconds} s (causa no determinada por el verificador)`);
      }
    }
  }

  // Cotejo JSON ↔ CSV.
  const cc = manifest.csv;
  const compare = { compared: 0, matched: 0, withinTolerance: 0, mismatched: [], onlyInJson: 0, onlyInCsv: 0, toleranceSeconds: cc?.toleranceSeconds ?? 0 };
  if (cc && rc) {
    const csv = parsed.get(cc.role);
    if (csv?.kind !== 'csv') fail('CSV_MISSING', cc.role);
    else {
      const byId = new Map(records.map((r) => [String(getPath(r, rc.idField)), r]));
      const csvIds = new Set();
      for (const row of csv.records) {
        const id = String(row[cc.idColumn] ?? '');
        csvIds.add(id);
        const j = byId.get(id);
        if (!j) { compare.onlyInCsv++; continue; }
        compare.compared++;
        const js = toSeconds(getPath(j, rc.durationField), rc.durationUnit);
        const cs = toSeconds(row[cc.durationColumn], cc.durationUnit);
        const delta = js == null || cs == null ? null : cs - js;
        if (delta === 0) compare.matched++;
        else if (delta != null && Math.abs(delta) <= compare.toleranceSeconds) compare.withinTolerance++;
        else compare.mismatched.push({ id, jsonSeconds: js, csvSeconds: cs, deltaSeconds: delta });
      }
      compare.onlyInJson = [...byId.keys()].filter((id) => !csvIds.has(id)).length;
      if (compare.mismatched.length) fail('CSV_JSON_MISMATCH', `${compare.mismatched.length} filas fuera de tolerancia`);
      const exp = manifest.expect ?? {};
      if (exp.comparedIds != null && exp.comparedIds !== compare.compared) fail('COMPARED_COUNT_MISMATCH', `esperado ${exp.comparedIds}, obtenido ${compare.compared}`);
    }
  }

  // Re-verificación: los originales no cambiaron durante la ejecución.
  for (const entry of manifest.files ?? []) {
    if (!entry.__snap) continue;
    const s = await stat(entry.__snap.abs);
    const again = await readOnce(entry.__snap.abs);
    if (s.size !== entry.__snap.size || s.mtimeMs !== entry.__snap.mtimeMs || again.sha256 !== entry.__snap.sha256) {
      fail('ORIGINAL_CHANGED_DURING_RUN', entry.role);
    }
    delete entry.__snap;
  }

  const status = findings.some((f) => f.level === 'FAIL') ? 'FAIL' : 'PASS';
  return {
    tool: 'plan2/verify-preservation-package',
    toolVersion: TOOL_VERSION,
    node: process.version,
    checkedAt: new Date().toISOString(),
    status,
    limits: [
      'SHA-256 igual = mismos bytes; no prueba autenticidad del origen ni exactitud de horas.',
      'Filas sintéticas se cuentan y preservan; no se suman como trabajo.',
      'El verificador no atribuye causa a diferencias de totales.',
      'laborSeconds es una suma descriptiva del respaldo: no son horas aprobadas, no autoriza pagos y no sustituye a TimeEntry como registro canónico.',
      'No lee ni infiere Evidence ni adjuntos.',
    ],
    files,
    summary,
    csvComparison: compare,
    findings,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const get = (flag) => { const k = args.indexOf(flag); return k >= 0 ? args[k + 1] : undefined; };
  const manifestPath = get('--manifest');
  const outPath = get('--out');
  if (!manifestPath || !outPath) {
    console.error('Uso: verify-preservation-package.mjs --manifest <m.json> --out <reporte.json>');
    process.exit(2);
  }
  const absManifest = path.resolve(manifestPath);
  const manifest = JSON.parse((await readOnce(absManifest)).buf.toString('utf8'));
  const baseDir = path.dirname(absManifest);
  const absOut = path.resolve(outPath);
  const inputs = new Set([absManifest, ...(manifest.files ?? []).map((f) => path.resolve(baseDir, f.path))]);
  const inputDirs = new Set((manifest.files ?? []).map((f) => path.dirname(path.resolve(baseDir, f.path))));
  if (inputs.has(absOut) || inputDirs.has(path.dirname(absOut))) {
    console.error('Rechazado: el reporte no puede escribirse sobre un original ni en su mismo directorio.');
    process.exit(2);
  }
  const report = await verifyPackage(manifest, { baseDir });
  await writeFile(absOut, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(`${report.status} — ${report.findings.length} hallazgos — ${absOut}`);
  process.exit(report.status === 'PASS' ? 0 : 1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
