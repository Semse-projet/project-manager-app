import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

// T-005 research-only suite: synthetic fixtures; never fetches BLS data,
// computes billable rates, mutates databases or accesses Railway.
test('OEWS May 2025 offline parser rejects ambiguous sources and preserves unknown provenance', () => {
  const candidates = [...new Set([process.env.PYTHON, 'python3', 'python'].filter(Boolean))];
  let result;
  let executable;

  for (const candidate of candidates) {
    const attempt = spawnSync(
      candidate,
      ['-m', 'unittest', 'discover', '-s', 'scripts/research', '-p', 'test_oews_coverage.py', '-v'],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        timeout: 45_000,
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
      },
    );
    if (attempt.error?.code === 'ENOENT') continue;
    executable = candidate;
    result = attempt;
    break;
  }

  assert.ok(result, 'Python 3.11+ is required to validate OEWS research input (not skipped)');
  assert.ifError(result.error);
  assert.equal(
    result.status, 0,
    `OEWS research suite failed via ${executable} (exit ${result.status})\n${result.stdout}\n${result.stderr}`,
  );
  assert.match(result.stderr, /Ran 5 tests?\b/, 'Must execute all 5 offline Python tests');
  assert.match(result.stderr, /^OK\s*$/m, 'The Python unittest suite must finish successfully');
});


test('T-005 crosswalk reconciliation stays synchronized with both drafts and the research parser', () => {
  const docs = 'docs/specs/api/';
  const read = (name) => readFileSync(docs + name, 'utf8');
  const socs = (text) => [...new Set(
    [...String(text).matchAll(/\b\d{2}-\d{4}\b/g)].map((m) => m[0]),
  )].sort();

  const rows = (text) => {
    const result = new Map();
    for (const line of text.split('\n')) {
      const cells = line.split('|').map((cell) => cell.trim());
      const trade = /^`([a-z-]+)`$/.exec(cells[1] || '')?.[1];
      if (!trade) continue;
      const candidate = socs(cells[2] || '');
      if (!candidate.length) continue;
      assert.ok(!result.has(trade), 'Duplicate SOC row for ' + trade);
      result.set(trade, {
        candidates: candidate,
        other: socs(cells[3] || ''),
        status: cells[4] || '',
      });
    }
    return result;
  };

  const operating = rows(read('cost-engine.national-labor-geo-tax-operating-model-2026-11-06.md'));
  const ingestion = rows(read('cost-engine.us-data-ingestion-and-24-trade-crosswalk-2026-11-06.md'));
  const evidence = read('cost-engine.t005-soc-crosswalk-reconciliation-2026-11-07.md');
  const reconciliation = rows(evidence);
  const script = readFileSync('scripts/research/oews_coverage.py', 'utf8');
  const block = /SOC = \{([\s\S]*?)\n\}/.exec(script)?.[1];
  assert.ok(block, 'The research SOC dictionary must remain inspectable');
  const scriptRows = new Map([...block.matchAll(/'([a-z-]+)'\s*:\s*'([\d\s-]+)'/g)]
    .map((match) => [match[1], socs(match[2])]));
  for (const [label, map] of [['operating', operating], ['ingestion', ingestion],
    ['reconciliation', reconciliation], ['research script', scriptRows]]) {
    assert.equal(map.size, 24, label + ' must list exactly 24 mapped trades');
    assert.deepEqual([...map.keys()].sort(), [...operating.keys()].sort(),
      label + ' must cover the identical engine set');
  }

  let conflicts = 0;
  for (const [trade, original] of operating) {
    const alternate = ingestion.get(trade);
    const record = reconciliation.get(trade);
    const mismatch = JSON.stringify(original.candidates) !== JSON.stringify(alternate.candidates);
    conflicts += Number(mismatch);
    assert.deepEqual(record.candidates, original.candidates,
      'Reconciliation operating cells drifted for ' + trade);
    assert.deepEqual(record.other, alternate.candidates,
      'Reconciliation ingestion cells drifted for ' + trade);
    assert.equal(record.status, mismatch ? 'CONFLICTO' : 'COINCIDENCIA DE BORRADORES',
      'Reconciliation status drifted for ' + trade);
    assert.deepEqual(scriptRows.get(trade), original.candidates,
      'Research-only SOC reference changed without amending the source draft for ' + trade);
  }
  // A future reviewed reconciliation may legitimately reduce the conflict count to zero.
  assert.ok(evidence.includes('**Conflictos:** ' + conflicts + '/24'),
    'Update the recorded conflict count when source mappings change');
  assert.match(evidence, /\*\*SOC comerciales aprobados:\*\* 0\/24/,
    'No source candidate may silently become an approved commercial wage map');
});
