import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

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
