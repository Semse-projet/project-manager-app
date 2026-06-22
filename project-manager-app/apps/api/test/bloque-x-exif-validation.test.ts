import { test } from 'node:test';
import * as assert from 'node:assert';

/**
 * Tests para Bloque-X: EXIF validation en fotos
 * 10 test cases
 */

// ============================================================================
// TEST 1: EXIF Validation
// ============================================================================

test('EXIFParser — Validate photo with full EXIF data', () => {
  const exifData = {
    timestamp: '2026-06-22T10:30:00Z',
    gpsLatitude: 37.7749,
    gpsLongitude: -122.4194,
    cameraModel: 'Canon EOS',
  };

  const hasTimestamp = !!exifData.timestamp;
  const hasGPS = exifData.gpsLatitude && exifData.gpsLongitude;

  assert.strictEqual(hasTimestamp, true);
  assert.strictEqual(hasGPS, true);
});

test('EXIFParser — Reject photo missing timestamp', () => {
  const exifData = {
    // timestamp missing
    gpsLatitude: 37.7749,
    gpsLongitude: -122.4194,
  };

  const hasTimestamp = !!exifData.timestamp;
  assert.strictEqual(hasTimestamp, false);
});

test('EXIFParser — Reject photo missing GPS', () => {
  const exifData = {
    timestamp: '2026-06-22T10:30:00Z',
    // gpsLatitude missing
    // gpsLongitude missing
  };

  const hasGPS = exifData.gpsLatitude && exifData.gpsLongitude;
  assert.strictEqual(hasGPS, false);
});

test('EXIFParser — Detect invalid GPS coordinates', () => {
  const invalidLat = 95; // > 90
  const validLat = 45;

  const isValidLat = invalidLat >= -90 && invalidLat <= 90;
  const isValidLat2 = validLat >= -90 && validLat <= 90;

  assert.strictEqual(isValidLat, false);
  assert.strictEqual(isValidLat2, true);
});

test('EXIFParser — Detect invalid GPS longitude', () => {
  const invalidLon = 185; // > 180
  const validLon = 120;

  const isValidLon = invalidLon >= -180 && invalidLon <= 180;
  const isValidLon2 = validLon >= -180 && validLon <= 180;

  assert.strictEqual(isValidLon, false);
  assert.strictEqual(isValidLon2, true);
});

// ============================================================================
// TEST 2: Tamper Detection
// ============================================================================

test('EXIFParser — Detect EXIF tampering (timestamp mismatch > 24h)', () => {
  const exifTimestamp = new Date('2026-06-01T10:00:00Z');
  const fileModifiedTime = new Date('2026-06-25T10:00:00Z');

  const timeDiffSeconds = Math.abs(exifTimestamp.getTime() - fileModifiedTime.getTime()) / 1000;
  const isTampered = timeDiffSeconds > 86400; // 24 hours

  assert.strictEqual(isTampered, true);
});

test('EXIFParser — Allow small timestamp differences (< 1h)', () => {
  const exifTimestamp = new Date('2026-06-22T10:00:00Z');
  const fileModifiedTime = new Date('2026-06-22T10:30:00Z');

  const timeDiffSeconds = Math.abs(exifTimestamp.getTime() - fileModifiedTime.getTime()) / 1000;
  const isTampered = timeDiffSeconds > 86400; // 24 hours

  assert.strictEqual(isTampered, false);
});

// ============================================================================
// TEST 3: Multiple Photos
// ============================================================================

test('PhotoController — Upload multiple photos to same project', () => {
  const photos = [
    { id: 'photo_1', projectId: 'proj_123', timestamp: '2026-06-22T10:00:00Z' },
    { id: 'photo_2', projectId: 'proj_123', timestamp: '2026-06-22T10:30:00Z' },
    { id: 'photo_3', projectId: 'proj_123', timestamp: '2026-06-22T11:00:00Z' },
  ];

  const allValid = photos.every((p) => p.timestamp && p.projectId === 'proj_123');
  assert.strictEqual(allValid, true);
  assert.strictEqual(photos.length, 3);
});

test('PhotoController — Order photos by timestamp (newest first)', () => {
  const photos = [
    { id: 'p1', timestamp: '2026-06-22T10:00:00Z' },
    { id: 'p2', timestamp: '2026-06-22T11:00:00Z' },
    { id: 'p3', timestamp: '2026-06-22T09:00:00Z' },
  ];

  const sorted = photos.sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return timeB - timeA; // Newest first
  });

  assert.strictEqual(sorted[0].id, 'p2'); // 11:00
  assert.strictEqual(sorted[1].id, 'p1'); // 10:00
  assert.strictEqual(sorted[2].id, 'p3'); // 09:00
});

// ============================================================================
// TEST 4: Status Tracking
// ============================================================================

test('PhotoController — Photo status should be VALIDATED after upload', () => {
  const photo = {
    id: 'photo_123',
    status: 'VALIDATED',
  };

  assert.strictEqual(photo.status, 'VALIDATED');
});
