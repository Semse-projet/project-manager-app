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
  assert.match(result.stderr, /Ran 15 tests?\b/, 'Must execute all 15 offline Python tests');
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


test('T-005 frozen BLS API snapshots preserve distinct series, wage values and quota states', () => {
  const prefix = 'docs/specs/api/';
  const parseSnapshot = (name) => {
    const [heading, ...lines] = readFileSync(prefix + name, 'utf8').trimEnd().split(/\r?\n/);
    const columns = heading.split(',');
    return lines.map((line) => {
      const values = line.split(',');
      assert.equal(values.length, columns.length, 'Malformed frozen BLS CSV row');
      return Object.fromEntries(columns.map((column, i) => [column, values[i]]));
    });
  };

  const initial = parseSnapshot('cost-engine.t005-bls-api-median-sample-2026-11-08.csv');
  const states = parseSnapshot('cost-engine.t005-bls-api-electricians-51-jurisdictions-2026-11-08.csv');
  assert.equal(initial.length, 38, 'Initial BLS sample must remain frozen');
  assert.equal(states.length, 51, 'The state/DC snapshot must cover 51 jurisdictions');

  const values = new Map();
  const code = /^OEU([SM])(\d{7})000000(\d{6})08$/;
  const validateSeries = (row, type, area, soc, value, link) => {
    const match = code.exec(row.series_id);
    assert.ok(match, 'Malformed detailed BLS OEWS median series ID');
    assert.equal(match[1], type);
    assert.equal(match[2], area);
    assert.equal(match[3], soc.replace('-', ''));
    assert.equal(link, 'https://api.bls.gov/publicAPI/v2/timeseries/data/' + row.series_id);
    assert.match(value, /^\d+\.\d{2}$/, 'Observed hourly wage must be a positive decimal, not null/zero');
    assert.ok(Number(value) > 0);
    assert.equal(row.year, '2025');
    assert.equal(row.period, 'A01');
    assert.equal(row.datatype_code, '08');
  };

  for (const row of initial) {
    assert.equal(row.origin, 'BLS_PUBLIC_API_V2');
    validateSeries(row, row.geography_type, row.area_code, row.soc_code,
      row.hourly_median_usd, row.source_url);
    assert.ok(!values.has(row.series_id), 'Duplicate series in the 38-row sample');
    values.set(row.series_id, row.hourly_median_usd);
  }
  assert.equal(initial.filter((row) =>
    row.geography_type === 'S' && row.area_code === '1200000').length, 32,
  'The Florida snapshot requires one observation per detailed candidate SOC');

  let observed = 0;
  let blocked = 0;
  let overlap = 0;
  const stateFips = new Set();
  const stateSeries = new Set();
  for (const row of states) {
    assert.match(row.area_code, /^\d{7}$/);
    assert.equal(row.area_code.slice(0, 2), row.jurisdiction_fips);
    assert.equal(row.area_code.slice(2), '00000');
    assert.equal(row.soc, '47-2111');
    assert.equal(row.series_id, 'OEUS' + row.area_code + '00000047211108');
    assert.equal(row.official_api_url,
      'https://api.bls.gov/publicAPI/v2/timeseries/data/' + row.series_id);
    assert.ok(!stateFips.has(row.jurisdiction_fips), 'Repeated state/DC jurisdiction');
    assert.ok(!stateSeries.has(row.series_id), 'Repeated state/DC series');
    assert.ok(!['66', '72', '78'].includes(row.jurisdiction_fips),
      'Territories are outside the 50 states + DC scope');
    stateFips.add(row.jurisdiction_fips);
    stateSeries.add(row.series_id);
    assert.equal(row.year, '2025');
    assert.equal(row.period, 'A01');
    assert.equal(row.datatype_code, '08');

    if (row.api_status === 'REQUEST_SUCCEEDED') {
      validateSeries(row, 'S', row.area_code, row.soc,
        row.hourly_median_usd, row.official_api_url);
      observed++;
      if (values.has(row.series_id)) {
        overlap++;
        assert.equal(values.get(row.series_id), row.hourly_median_usd,
          'Conflicting official wage observations for the same year/period/series');
      } else {
        values.set(row.series_id, row.hourly_median_usd);
      }
    } else {
      assert.equal(row.api_status, 'REQUEST_NOT_PROCESSED_DAILY_QUOTA',
        'Unrecognized BLS response status must not be interpreted as missing wage');
      assert.equal(row.hourly_median_usd, '',
        'Daily quota failures cannot become zero wages or imputed values');
      blocked++;
    }
  }

  assert.equal(observed, 15);
  assert.equal(blocked, 36);
  assert.equal(overlap, 3, 'Cross-snapshot duplicate series must be deduplicated');
  assert.equal(values.size, 50, 'Exactly 50 distinct observed BLS series are evidenced');
});
