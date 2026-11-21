#!/usr/bin/env node
// Plan 2 — comparación v4 ↔ v6 de colecciones exportadas del Site (solo lectura).
//
// Entrada: dos exportaciones JSON con forma { "<colección>": [ {..}, ... ] }
// o { "collections": { ... } }. No publica, no importa, no combina, no
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

function collectionsOf(doc) {
  const root = doc && typeof doc === 'object' && doc.collections && typeof doc.collections === 'object' ? doc.collections : doc;
  return Object.fromEntries(Object.entries(root ?? {}).filter(([, v]) => Array.isArray(v)));
}

function changedFields(a, b) {
  const keys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  return [...keys].filter((k) => canonical(a?.[k]) !== canonical(b?.[k])).sort();
}

export function parseCountSpec(spec) {
  const m = /^([^:]+):([^=]+)=(.*)$/.exec(spec ?? '');
  return m ? { collection: m[1], field: m[2], value: m[3] } : null;
}

export function diffCollections(docA, docB, { key = 'id', counts = [] } = {}) {
  const A = collectionsOf(docA);
  const B = collectionsOf(docB);
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
    for (const [k, va] of ma) {
      const vb = mb.get(k);
      if (!vb) { out.onlyInA.push(k); continue; }
      const ha = va.map(hashOf);
      const hb = vb.map(hashOf);
      if (va.length === 1 && vb.length === 1 && ha[0] === hb[0]) { out.identical++; continue; }
      out.collisions.push({ key: k, hashesA: ha, hashesB: hb, changedFields: va.length === 1 && vb.length === 1 ? changedFields(va[0], vb[0]) : ['<clave duplicada>'] });
      bodies.push({ collection: name, key: k, versionA: va, versionB: vb });
    }
    for (const k of mb.keys()) if (!ma.has(k)) out.onlyInB.push(k);
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
      conflictos: out.collisions.length + out.duplicateKeys.a.length + out.duplicateKeys.b.length,
      huerfanosA: out.onlyInA.filter((k) => !candidateA.has(k)).length,
      huerfanosB: out.onlyInB.filter((k) => !candidateB.has(k)).length,
      sinClave: out.keyless.a + out.keyless.b,
    };
    collections.push(out);
  }
  const countResults = counts.map(parseCountSpec).filter(Boolean).map((c) => {
    const match = (list) => (list ?? []).filter((r) => String(r?.[c.field]) === c.value).length;
    return { ...c, matchesA: match(A[c.collection]), matchesB: match(B[c.collection]) };
  });
  // Candidatos cuentan como no resueltos: requieren decisión humana.
  const totalCollisions = collections.reduce((s, c) => s + c.classification.conflictos + c.classification.sinClave + c.classification.candidatos, 0);
  return { collections, counts: countResults, unresolvedCollisions: totalCollisions, bodies };
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
    inputs: { a: { path: a, sha256: da.sha256, bytes: da.bytes }, b: { path: b, sha256: db.sha256, bytes: db.bytes } },
    verdict: summary.unresolvedCollisions === 0 ? 'NO_COLLISIONS' : 'COLLISIONS_UNRESOLVED_DO_NOT_IMPORT',
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
