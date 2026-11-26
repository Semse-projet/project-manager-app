import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  assertStorageWriteAdmission,
  assertStorageWritePublication,
  resolveFreezeExpiresAt,
  resolveStorageWriteGateTransition,
  storageWriteGateBlocksNewWrites,
  storageWriteGateTransitionRequestDigest,
  StorageWriteGateBlockedError,
} from '../../apps/api/src/infrastructure/storage/storage-write-gate-state.ts';

const state = (phase = 'OPEN', overrides = {}) => ({
  phase, activeOperations: 0, ambiguousOperations: 0,
  writerCoverageComplete: true, ...overrides,
});
const req = (action, overrides = {}) => ({
  action, administratorAuthorized: true, ticket: 'RECOVERY-954-001',
  authorityAvailable: true, ...overrides,
});
const blocked = (fn, reason) => assert.throws(fn, e =>
  e instanceof StorageWriteGateBlockedError && e.reason === reason);

test('admit only while OPEN and the authoritative store is reachable', () => {
  assert.doesNotThrow(() => assertStorageWriteAdmission(state(), true));
  blocked(() => assertStorageWriteAdmission(state('DRAINING'), true), 'not_open');
  blocked(() => assertStorageWriteAdmission(state('FROZEN'), true), 'not_open');
  blocked(() => assertStorageWriteAdmission(state(), false), 'authority_unavailable');
});

test('reject invalid or internally contradictory snapshots', () => {
  blocked(() => assertStorageWriteAdmission(state('FROZEN', { activeOperations: 1 }), true), 'inconsistent_frozen_snapshot');
  blocked(() => assertStorageWriteAdmission(state('FROZEN', { writerCoverageComplete: false }), true), 'inconsistent_frozen_snapshot');
  blocked(() => assertStorageWriteAdmission(state('OPEN', { activeOperations: -1 }), true), 'invalid_snapshot');
  blocked(() => assertStorageWriteAdmission(state('OPEN', { ambiguousOperations: NaN }), true), 'invalid_snapshot');
});

test('a previously admitted writer can finish during drain, never after freeze', () => {
  assert.doesNotThrow(() => assertStorageWritePublication(state('DRAINING', {activeOperations: 1}), true, true));
  blocked(() => assertStorageWritePublication(state('OPEN'), true, false), 'missing_active_ticket');
  blocked(() => assertStorageWritePublication(state('FROZEN'), true, true), 'already_frozen');
  blocked(() => assertStorageWritePublication(state(), false, true), 'authority_unavailable');
});

test('BEGIN_DRAIN needs an administrator and audited ticket', () => {
  assert.equal(resolveStorageWriteGateTransition(state(), req('BEGIN_DRAIN')), 'DRAINING');
  blocked(() => resolveStorageWriteGateTransition(state(), req('BEGIN_DRAIN', {administratorAuthorized: false})), 'administrator_required');
  blocked(() => resolveStorageWriteGateTransition(state(), req('BEGIN_DRAIN', {ticket: '../x'})), 'invalid_audit_ticket');
  blocked(() => resolveStorageWriteGateTransition(state('DRAINING'), req('BEGIN_DRAIN')), 'transition_conflict');
});

test('FROZEN requires a fully drained and inventoried writer set', () => {
  assert.equal(resolveStorageWriteGateTransition(state('DRAINING'), req('MARK_FROZEN')), 'FROZEN');
  blocked(() => resolveStorageWriteGateTransition(state('DRAINING', {activeOperations: 1}), req('MARK_FROZEN')), 'active_operations');
  blocked(() => resolveStorageWriteGateTransition(state('DRAINING', {ambiguousOperations: 1}), req('MARK_FROZEN')), 'ambiguous_operations');
  blocked(() => resolveStorageWriteGateTransition(state('DRAINING', {writerCoverageComplete: false}), req('MARK_FROZEN')), 'writer_coverage_incomplete');
  blocked(() => resolveStorageWriteGateTransition(state('OPEN'), req('MARK_FROZEN')), 'transition_conflict');
});

test('thaw or abort drain requires explicit closed recovery window', () => {
  blocked(() => resolveStorageWriteGateTransition(state('FROZEN'), req('THAW')), 'recovery_window_not_closed');
  blocked(() => resolveStorageWriteGateTransition(state('DRAINING'), req('ABORT_DRAIN')), 'recovery_window_not_closed');
  assert.equal(resolveStorageWriteGateTransition(state('FROZEN'), req('THAW', {recoveryWindowClosed: true})), 'OPEN');
  assert.equal(resolveStorageWriteGateTransition(state('DRAINING'), req('ABORT_DRAIN', {recoveryWindowClosed: true})), 'OPEN');
  blocked(() => resolveStorageWriteGateTransition(state('OPEN'), req('THAW', {recoveryWindowClosed: true})), 'transition_conflict');
});

test('a pre-TTL transition digest replays when the retry omits TTL', () => {
  const historicalFields = {
    action: 'BEGIN_DRAIN',
    expectedEpoch: '1',
    actorUserId: 'synthetic-ops-admin',
    ticket: 't008-historical-drain',
    reason: 'synthetic staging control-plane acceptance',
  };
  const historical = createHash('sha256').update(JSON.stringify(historicalFields)).digest('hex');
  assert.equal(storageWriteGateTransitionRequestDigest(historicalFields), historical);
  assert.equal(storageWriteGateTransitionRequestDigest({
    ...historicalFields,
    freezeTtlSeconds: undefined,
  }), historical);
  const withTtl = storageWriteGateTransitionRequestDigest({
    ...historicalFields,
    freezeTtlSeconds: 300,
  });
  assert.notEqual(withTtl, historical);
  assert.equal(withTtl, createHash('sha256').update(JSON.stringify({
    ...historicalFields,
    freezeTtlSeconds: 300,
  })).digest('hex'));
});

test('freeze TTL is required in production mutate and never reopens writes', () => {
  const now = new Date('2026-11-25T12:00:00.000Z');
  blocked(() => resolveFreezeExpiresAt('MARK_FROZEN', undefined, true, now), 'freeze_ttl_required');
  blocked(() => resolveFreezeExpiresAt('MARK_FROZEN', 60, true, now), 'invalid_freeze_ttl');
  blocked(() => resolveFreezeExpiresAt('MARK_FROZEN', 14401, true, now), 'invalid_freeze_ttl');
  assert.equal(resolveFreezeExpiresAt('BEGIN_DRAIN', undefined, true, now), null);
  assert.equal(resolveFreezeExpiresAt('MARK_FROZEN', undefined, false, now), null);
  const expires = resolveFreezeExpiresAt('MARK_FROZEN', 300, true, now);
  assert.equal(expires.toISOString(), '2026-11-25T12:05:00.000Z');

  const future = storageWriteGateBlocksNewWrites('FROZEN', expires, now);
  assert.equal(future.blocked, true);
  assert.equal(future.freezeExpired, false);
  const overdue = storageWriteGateBlocksNewWrites('FROZEN', expires, new Date('2026-11-25T12:05:00.000Z'));
  assert.equal(overdue.blocked, true);
  assert.equal(overdue.freezeExpired, true);
  const open = storageWriteGateBlocksNewWrites('OPEN', expires, new Date('2026-11-25T13:00:00.000Z'));
  assert.equal(open.blocked, false);
  assert.equal(open.freezeExpired, false);
});

test('downstream dependency errors cannot silently authorize a transition', () => {
  blocked(() => resolveStorageWriteGateTransition(state(), req('BEGIN_DRAIN', {authorityAvailable: false})), 'authority_unavailable');
  blocked(() => resolveStorageWriteGateTransition(state('DRAINING'), req('MARK_FROZEN', {authorityAvailable: false})), 'authority_unavailable');
});
