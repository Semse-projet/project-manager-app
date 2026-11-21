// Pruebas sintéticas de las herramientas de Plan 2. Ningún dato real: fixtures
// generados en un directorio temporal que sólo este test crea y borra.
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parseCsv, verifyPackage } from '../../scripts/plan2/verify-preservation-package.mjs';
import { diffCollections } from '../../scripts/plan2/diff-site-collections.mjs';
import { runStaticEvidence } from '../../scripts/plan2/static-evidence.mjs';

const sha = (s) => createHash('sha256').update(s).digest('hex');

describe('plan2 verify-preservation-package (sintético)', () => {
  let dir;
  const entries = [
    { id: 'e1', purpose: 'payable', durationSeconds: 3600 },
    { id: 'e2', purpose: 'payable', durationSeconds: 1800 },
    { id: 'e3', purpose: 'personal', durationSeconds: 600 },
    { id: 's1', purpose: 'synthetic', durationSeconds: 9999 },
  ];
  const backup = JSON.stringify({ entries });
  const exportA = JSON.stringify({ entries, exportedAt: 'A' });
  const exportB = JSON.stringify({ entries, exportedAt: 'B' });
  const csv = 'id,duration\r\n"e1",3600\r\ne2,1812\r\ne3,600\r\n';

  before(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'plan2-verify-'));
    await writeFile(path.join(dir, 'backup.json'), backup);
    await writeFile(path.join(dir, 'a.json'), exportA);
    await writeFile(path.join(dir, 'b.json'), exportB);
    await writeFile(path.join(dir, 'rows.csv'), csv);
  });
  after(async () => { await rm(dir, { recursive: true, force: true }); });

  const manifest = (over = {}) => ({
    files: [
      { role: 'backup_json', path: 'backup.json', expectedSha256: sha(backup) },
      { role: 'export_a', path: 'a.json' },
      { role: 'export_b', path: 'b.json' },
      { role: 'csv', path: 'rows.csv' },
    ],
    mustRemainDistinct: [['export_a', 'export_b']],
    records: { jsonRole: 'backup_json', recordsPath: 'entries', idField: 'id', durationField: 'durationSeconds', durationUnit: 'seconds', purposeField: 'purpose', laborPurpose: 'payable', syntheticMarker: { field: 'purpose', value: 'synthetic' } },
    csv: { role: 'csv', idColumn: 'id', durationColumn: 'duration', durationUnit: 'seconds', toleranceSeconds: 24 },
    expect: { laborRecords: 2, syntheticRecords: 1, comparedIds: 3, uiTotalSeconds: 5520 },
    ...over,
  });

  it('PASS con hash correcto, exportaciones distintas, tolerancia de precisión y sintético excluido', async () => {
    const before = await stat(path.join(dir, 'backup.json'));
    const r = await verifyPackage(manifest(), { baseDir: dir });
    assert.equal(r.status, 'PASS', JSON.stringify(r.findings));
    assert.equal(r.summary.syntheticRecords, 1);
    assert.equal(r.summary.laborSeconds, 5400, 'el sintético y el personal no se suman como trabajo');
    assert.equal(r.summary.uiMinusLaborSeconds, 120, 'la diferencia se informa');
    assert.ok(r.findings.some((f) => f.code === 'UI_TOTAL_DIFFERS' && f.level === 'WARN'), 'sin atribuir causa');
    assert.equal(r.csvComparison.withinTolerance, 1);
    assert.equal(r.csvComparison.compared, 3);
    const afterStat = await stat(path.join(dir, 'backup.json'));
    assert.equal(afterStat.mtimeMs, before.mtimeMs, 'original intacto');
    assert.equal(await readFile(path.join(dir, 'backup.json'), 'utf8'), backup);
  });

  it('informa sumas alternativas sin atribuir causa', async () => {
    const rows = [
      { id: 'p1', purpose: 'payable', accumulatedSeconds: 119, durationMinutes: 1 },
      { id: 'p2', purpose: 'payable', accumulatedSeconds: 121, durationMinutes: 2 },
      { id: 'p3', purpose: 'payable', accumulatedSeconds: 30, durationMinutes: null },
    ];
    const body = JSON.stringify(rows);
    await writeFile(path.join(dir, 'alt.json'), body);
    const r = await verifyPackage({
      files: [{ role: 'j', path: 'alt.json', expectedSha256: sha(body) }],
      records: {
        jsonRole: 'j', idField: 'id', durationField: 'accumulatedSeconds', durationUnit: 'seconds', purposeField: 'purpose', laborPurpose: 'payable',
        alternativeDurations: [{ label: 'UI: durationMinutes·60 o accumulatedSeconds', field: 'durationMinutes', unit: 'minutes', fallbackField: 'accumulatedSeconds', fallbackUnit: 'seconds' }],
      },
      expect: { uiTotalSeconds: 210 },
    }, { baseDir: dir });
    assert.equal(r.summary.laborSeconds, 270);
    assert.deepEqual(r.summary.alternativeSums, [{ label: 'UI: durationMinutes·60 o accumulatedSeconds', seconds: 210, minusPrimarySeconds: -60, uiMinusThisSeconds: 0 }]);
    assert.ok(r.findings.some((f) => f.code === 'UI_TOTAL_DIFFERS'), 'la diferencia frente a la suma primaria sigue informada');
  });

  it('FAIL ante hash alterado', async () => {
    const m = manifest();
    m.files[0].expectedSha256 = '0'.repeat(64);
    const r = await verifyPackage(m, { baseDir: dir });
    assert.equal(r.status, 'FAIL');
    assert.ok(r.findings.some((f) => f.code === 'HASH_MISMATCH'));
  });

  it('FAIL si dos exportaciones declaradas distintas son idénticas', async () => {
    const m = manifest();
    m.files[2].path = 'a.json';
    const r = await verifyPackage(m, { baseDir: dir });
    assert.ok(r.findings.some((f) => f.code === 'EXPORTS_NOT_DISTINCT'));
  });

  it('FAIL si la diferencia CSV supera la tolerancia', async () => {
    const r = await verifyPackage(manifest({ csv: { role: 'csv', idColumn: 'id', durationColumn: 'duration', durationUnit: 'seconds', toleranceSeconds: 0 } }), { baseDir: dir });
    assert.ok(r.findings.some((f) => f.code === 'CSV_JSON_MISMATCH'));
    assert.deepEqual(r.csvComparison.mismatched.map((x) => [x.id, x.deltaSeconds]), [['e2', 12]]);
  });

  it('parseCsv maneja comillas, comas y CRLF', () => {
    const { header, records } = parseCsv('﻿a,b\r\n"x, ""y""",2\n');
    assert.deepEqual(header, ['a', 'b']);
    assert.deepEqual(records, [{ a: 'x, "y"', b: '2' }]);
  });
});

describe('plan2 diff-site-collections (sintético)', () => {
  it('conserva ambas versiones de cada colisión y no las resuelve', () => {
    const v4 = { Excepciones: [{ id: 'x1', estado: 'abierta' }, { id: 'x2', estado: 'cerrada' }], Horas: [{ id: 'h1', s: 1 }] };
    const v6 = { collections: { Excepciones: [{ id: 'x1', estado: 'cerrada' }, { id: 'x3', estado: 'abierta' }], Horas: [{ id: 'h1', s: 1 }] } };
    const r = diffCollections(v4, v6, { counts: ['Excepciones:estado=abierta'] });
    const exc = r.collections.find((c) => c.name === 'Excepciones');
    assert.equal(exc.collisions.length, 1);
    assert.deepEqual(exc.collisions[0].changedFields, ['estado']);
    assert.deepEqual(exc.onlyInA, ['x2']);
    assert.deepEqual(exc.onlyInB, ['x3']);
    assert.equal(r.bodies[0].versionA[0].estado, 'abierta');
    assert.equal(r.bodies[0].versionB[0].estado, 'cerrada');
    assert.equal(r.collections.find((c) => c.name === 'Horas').identical, 1);
    assert.deepEqual(r.counts.map((c) => [c.matchesA, c.matchesB]), [[1, 1]]);
    assert.ok(r.unresolvedCollisions > 0);
  });

  it('claves duplicadas y registros sin clave cuentan como no resueltos', () => {
    const r = diffCollections({ C: [{ id: 'a' }, { id: 'a', v: 2 }, { v: 3 }] }, { C: [{ id: 'a' }] });
    assert.ok(r.unresolvedCollisions >= 2);
  });
});

describe('plan2 static-evidence (repositorio)', () => {
  it('ejecuta todos los controles y devuelve un estado por control', async () => {
    const root = path.resolve(import.meta.dirname, '..', '..');
    const r = await runStaticEvidence(root);
    assert.ok(r.results.length >= 10);
    for (const res of r.results) assert.ok(['HOLDS', 'DOES_NOT_HOLD', 'FILE_MISSING', 'SECTION_MISSING'].includes(res.status), res.id);
  });
});
