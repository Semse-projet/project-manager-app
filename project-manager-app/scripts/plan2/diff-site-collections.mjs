#!/usr/bin/env node
// Plan 2 — comparación v4 ↔ v6 de colecciones exportadas del Site (solo lectura).
//
// Entrada: dos exportaciones JSON con forma { "<colección>": [ {..}, ... ] },
// { "collections": { ... } } o { "data": { ... } } (formato semse-hours-site-v1).
// Las colecciones-mapa (objetos como assignments o reviews) se comparan por
// clave de mapa. La comparación usa TODOS los campos (incluidos source y
// synthetic), a diferencia del comparador del navegador de v5/v6. No publica, no importa, no combina, no
// resuelve conflictos: los enumera y conserva AMBAS versiones por su hash.
//
// Salida (JSON): por colección, recuentos, sólo-en-A, sólo-en-B, idénticos,
// colisiones (misma clave, contenido distinto) con hash de cada versión y los
// campos que difieren. Con --bodies-out se escriben los cuerpos completos de
// ambas versiones de cada colisión en un archivo aparte (puede contener datos
// personales: guardarlo con el mismo control de acceso que los originales).
//
// --count "<colección>:<campo>=<valor>" cuenta registros que cumplen el filtro
// en cada versión, para explicar diferencias de vistas (p. ej. Excepciones 0
// frente a 2) sin adivinar el filtro de la interfaz.
//
// Uso:
//   node scripts/plan2/diff-site-collections.mjs --a v4.json --b v6.json --out diff.json \
//     [--key id] [--bodies-out colisiones.json] [--count "Excepciones:estado=abierta"]
import { createHash } from 'node:crypto';
import { open, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
const hashOf = (v) => createHash('sha256').update(canonical(v)).digest('hex');

async function readJson(file) {
  const fh = await open(file, 'r');
  try {
    const buf = await fh.readFile();
    return { data: JSON.parse(buf.toString('utf8')), sha256: createHash('sha256').update(buf).digest('hex'), bytes: buf.length };
  } finally { await fh.close(); }
}

/** Raíz de colecciones: `collections`, `data` (formato semse-hours-site-v1) o el propio documento. */
export function collectionsRoot(doc) {
  if (doc && typeof doc === 'object') {
    if (doc.collections && typeof doc.collections === 'object') return doc.collections;
    if (doc.data && typeof doc.data === 'object' && !Array.isArray(doc.data)) return doc.data;
  }
  return doc;
}

/** Arreglos se comparan por `key`; objetos-mapa (p. ej. assignments, reviews) por su clave de mapa. */
function collectionsOf(doc, key) {
  const out = {};
  for (const [name, v] of Object.entries(collectionsRoot(doc) ?? {})) {
    if (Array.isArray(v)) out[name] = v;
    else if (v && typeof v === 'object') out[name] = Object.entries(v).map(([k, value]) => ({ [key]: k, value, __mapEntry: true }));
  }
  return out;
}

export const canonicalSha256 = (v) => createHash('sha256').update(canonical(v)).digest('hex');

function changedFields(a, b) {
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  return [...keys].filter((k) => canonical(a?.[k]) !== canonical(b?.[k])).sort();
}

export function parseCountSpec(spec) {
  const m = /^([^:]+):([^=]+)=(.*)$/.exec(spec ?? '');
  return m ? { collection: m[1], field: m[2], value: m[3] } : null;
}

export function diffCollections(docA, docB, { key = 'id', counts = [] } = {}) {
  const A = collectionsOf(docA, key);
  const B = collectionsOf(docB, key);
  const names = [...new Set([...Object.keys(A), ...Object.keys(B)])].sort();
  const collections = [];
  const bodies = [];
  for (const name of names) {
    const ra = A[name] ?? [];
    const rb = B[name] ?? [];
    const out = { name, inA: name in A, inB: name in B, countA: ra.length, countB: rb.length, identical: 0, onlyInA: [], onlyInB: [], collisions: [], keyless: { a: 0, b: 0 }, duplicateKeys: { a: [], b: [] } };
    const index = (list, side) => {
      const map = new Map();
      for (const r of list) {
        const k = r?.[key];
        if (k === undefined || k === null || k === '') { out.keyless[side]++; continue; }
        const ks = String(k);
        if (map.has(ks)) { out.duplicateKeys[side].push(ks); map.get(ks).push(r); } else map.set(ks, [r]);
      }
      return map;
    };
    const ma = index(ra, 'a');
    const mb = index(rb, 'b');
    // Recorre la unión de claves. Una clave duplicada en cualquiera de los dos
    // lados es UN conflicto (se cuenta una sola vez), conserva todos sus cuerpos
    // y queda fuera de candidatos y huérfanos.
    const allKeys = [...new Set([...ma.keys(), ...mb.keys()])].sort();
    for (const k of allKeys) {
      const va = ma.get(k) ?? [];
      const vb = mb.get(k) ?? [];
      if (va.length > 1 || vb.length > 1) {
        out.collisions.push({ key: k, duplicateKey: true, hashesA: va.map(hashOf), hashesB: vb.map(hashOf), changedFields: ['<clave duplicada>'] });
        bodies.push({ collection: name, key: k, versionA: va, versionB: vb });
        continue;
      }
      if (va.length && vb.length) {
        const ha = hashOf(va[0]);
        const hb = hashOf(vb[0]);
        if (ha === hb) { out.identical++; continue; }
        out.collisions.push({ key: k, hashesA: [ha], hashesB: [hb], changedFields: changedFields(va[0], vb[0]) });
        bodies.push({ collection: name, key: k, versionA: va, versionB: vb });
      } else if (va.length) out.onlyInA.push(k);
      else out.onlyInB.push(k);
    }
    out.duplicateKeys = { a: [...new Set(out.duplicateKeys.a)], b: [...new Set(out.duplicateKeys.b)] };
    // Candidatos: registros sin pareja por clave cuyo contenido (sin la clave)
    // es byte-idéntico en canónico al de un registro sin pareja del otro lado.
    // Sólo se listan para revisión humana; nunca se emparejan ni combinan.
    const withoutKey = (r) => { const { [key]: _omit, ...rest } = r ?? {}; return hashOf(rest); };
    const orphanB = new Map();
    for (const k of out.onlyInB) for (const r of mb.get(k)) {
      const h = withoutKey(r);
      if (!orphanB.has(h)) orphanB.set(h, []);
      orphanB.get(h).push(k);
    }
    out.candidates = [];
    const candidateA = new Set();
    const candidateB = new Set();
    for (const k of out.onlyInA) for (const r of ma.get(k)) {
      const ks = orphanB.get(withoutKey(r));
      if (ks) { out.candidates.push({ keyA: k, keysB: ks }); candidateA.add(k); ks.forEach((x) => candidateB.add(x)); }
    }
    out.classification = {
      coincidencias: out.identical,
      candidatos: out.candidates.length,
      conflictos: out.collisions.length,
      huerfanosA: out.onlyInA.filter((k) => !candidateA.has(k)).length,
      huerfanosB: out.onlyInB.filter((k) => !candidateB.has(k)).length,
      sinClave: out.keyless.a + out.keyless.b,
    };
    collections.push(out);
  }
  const countResults = counts.map(parseCountSpec).filter(Boolean).map((c) => {
    // En colecciones-mapa el registro original está en `value`.
    const match = (list) => (list ?? []).filter((r) => String((r?.__mapEntry ? r.value : r)?.[c.field]) === c.value).length;
    return { ...c, matchesA: match(A[c.collection]), matchesB: match(B[c.collection]) };
  });
  // Candidatos cuentan como no resueltos: requieren decisión humana.
  const totalCollisions = collections.reduce((s, c) => s + c.classification.conflictos + c.classification.sinClave + c.classification.candidatos, 0);
  // Registros presentes en un solo snapshot también requieren decisión (Plan 2 §8.2).
  const orphans = collections.reduce((s, c) => s + c.classification.huerfanosA + c.classification.huerfanosB, 0);
  return { collectionsFound: names.length, collections, counts: countResults, unresolvedCollisions: totalCollisions, orphansRequiringDecision: orphans, bodies };
}

async function main() {
  const args = process.argv.slice(2);
  const get = (flag) => { const k = args.indexOf(flag); return k >= 0 ? args[k + 1] : undefined; };
  const all = (flag) => args.flatMap((v, k) => (args[k - 1] === flag ? [v] : []));
  const a = get('--a'); const b = get('--b'); const out = get('--out');
  if (!a || !b || !out) { console.error('Uso: diff-site-collections.mjs --a v4.json --b v6.json --out diff.json [--key id] [--bodies-out f.json] [--count "C:campo=valor"]'); process.exit(2); }
  const [da, db] = await Promise.all([readJson(path.resolve(a)), readJson(path.resolve(b))]);
  const result = diffCollections(da.data, db.data, { key: get('--key') ?? 'id', counts: all('--count') });
  const { bodies, ...summary } = result;
  const report = {
    tool: 'plan2/diff-site-collections', checkedAt: new Date().toISOString(),
    inputs: {
      a: { path: a, sha256: da.sha256, bytes: da.bytes, canonicalCollectionsSha256: canonicalSha256(collectionsRoot(da.data)) },
      b: { path: b, sha256: db.sha256, bytes: db.bytes, canonicalCollectionsSha256: canonicalSha256(collectionsRoot(db.data)) },
    },
    canonicalization: 'claves ordenadas recursivamente, sin espacios, JSON.stringify de JS; puede diferir de otra implementación en escapes no ASCII o formato numérico: cotejar antes de equiparar hashes',
    verdict: summary.collectionsFound === 0 ? 'NO_COLLECTIONS_FOUND'
      : summary.unresolvedCollisions > 0 ? 'COLLISIONS_UNRESOLVED_DO_NOT_IMPORT'
      : summary.orphansRequiringDecision > 0 ? 'DIFFERENCES_REQUIRE_DECISION'
      : 'NO_COLLISIONS',
    ...summary,
  };
  await writeFile(path.resolve(out), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  const bodiesOut = get('--bodies-out');
  if (bodiesOut) await writeFile(path.resolve(bodiesOut), JSON.stringify(bodies, null, 2) + '\n', { flag: 'wx' });
  console.log(`${report.verdict} — colisiones sin resolver: ${summary.unresolvedCollisions}`);
  process.exit(report.verdict === 'NO_COLLISIONS' ? 0 : 1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err) => { console.error(err); process.exit(1); });
}
