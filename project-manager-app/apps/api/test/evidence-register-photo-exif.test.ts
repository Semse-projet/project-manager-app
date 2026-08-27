import test from "node:test";
import assert from "node:assert/strict";
import { EvidenceService } from "../dist/modules/evidence/evidence.service.js";

// m2.2-dispute-docs Bloque 2.2.A — EvidenceService.registerPhotoWithExif()
// against the real class (not a reimplementation), the pattern this
// module's other tests (evidence-crud-phase2.test.ts) don't follow.

function makeFakeStorage(buffer: Buffer) {
  return { async readBuffer() { return buffer; } };
}

function makeFakeRepository(calls: Array<Record<string, unknown>>) {
  return {
    async create(input: Record<string, unknown>) {
      calls.push(input);
      return { id: "ev_1", projectId: input.projectId, ...input };
    },
  };
}

function makeFakeAudit() {
  return { async append() {} };
}

// Minimal valid EXIF JPEG builder shared with evidence-exif.test.ts's
// approach, trimmed to just what these tests need (a buffer that
// parsePhotoExif can and cannot successfully read).
function buildJpegWithExif(hasExif: boolean): Buffer {
  if (!hasExif) {
    return Buffer.from([0xff, 0xd8, 0xff, 0xd9]); // SOI + EOI, no APP1
  }

  const OFFSET_IFD0 = 8;
  const OFFSET_EXIF_IFD = OFFSET_IFD0 + (2 + 2 * 12 + 4);
  const dateTimeBytes = Buffer.from("2026:06:21 14:30:00\0", "ascii");
  const OFFSET_EXIF_DATA = OFFSET_EXIF_IFD + (2 + 1 * 12 + 4);
  const OFFSET_GPS_IFD = OFFSET_EXIF_DATA + dateTimeBytes.length;
  const OFFSET_LAT_DATA = OFFSET_GPS_IFD + (2 + 4 * 12 + 4);
  const OFFSET_LON_DATA = OFFSET_LAT_DATA + 24;
  const total = OFFSET_LON_DATA + 24;

  const tiff = Buffer.alloc(total);
  tiff.write("II", 0, "ascii");
  tiff.writeUInt16LE(0x002a, 2);
  tiff.writeUInt32LE(OFFSET_IFD0, 4);

  let p = OFFSET_IFD0;
  tiff.writeUInt16LE(2, p); p += 2;
  tiff.writeUInt16LE(0x8769, p); tiff.writeUInt16LE(4, p + 2); tiff.writeUInt32LE(1, p + 4); tiff.writeUInt32LE(OFFSET_EXIF_IFD, p + 8); p += 12;
  tiff.writeUInt16LE(0x8825, p); tiff.writeUInt16LE(4, p + 2); tiff.writeUInt32LE(1, p + 4); tiff.writeUInt32LE(OFFSET_GPS_IFD, p + 8); p += 12;
  tiff.writeUInt32LE(0, p);

  p = OFFSET_EXIF_IFD;
  tiff.writeUInt16LE(1, p); p += 2;
  tiff.writeUInt16LE(0x9003, p); tiff.writeUInt16LE(2, p + 2); tiff.writeUInt32LE(dateTimeBytes.length, p + 4); tiff.writeUInt32LE(OFFSET_EXIF_DATA, p + 8); p += 12;
  tiff.writeUInt32LE(0, p);
  dateTimeBytes.copy(tiff, OFFSET_EXIF_DATA);

  p = OFFSET_GPS_IFD;
  tiff.writeUInt16LE(4, p); p += 2;
  tiff.writeUInt16LE(0x0001, p); tiff.writeUInt16LE(2, p + 2); tiff.writeUInt32LE(2, p + 4); tiff.write("N\0", p + 8, "ascii"); p += 12;
  tiff.writeUInt16LE(0x0002, p); tiff.writeUInt16LE(5, p + 2); tiff.writeUInt32LE(3, p + 4); tiff.writeUInt32LE(OFFSET_LAT_DATA, p + 8); p += 12;
  tiff.writeUInt16LE(0x0003, p); tiff.writeUInt16LE(2, p + 2); tiff.writeUInt32LE(2, p + 4); tiff.write("W\0", p + 8, "ascii"); p += 12;
  tiff.writeUInt16LE(0x0004, p); tiff.writeUInt16LE(5, p + 2); tiff.writeUInt32LE(3, p + 4); tiff.writeUInt32LE(OFFSET_LON_DATA, p + 8); p += 12;
  tiff.writeUInt32LE(0, p);

  tiff.writeUInt32LE(37, OFFSET_LAT_DATA); tiff.writeUInt32LE(1, OFFSET_LAT_DATA + 4);
  tiff.writeUInt32LE(46, OFFSET_LAT_DATA + 8); tiff.writeUInt32LE(1, OFFSET_LAT_DATA + 12);
  tiff.writeUInt32LE(2964, OFFSET_LAT_DATA + 16); tiff.writeUInt32LE(100, OFFSET_LAT_DATA + 20);
  tiff.writeUInt32LE(122, OFFSET_LON_DATA); tiff.writeUInt32LE(1, OFFSET_LON_DATA + 4);
  tiff.writeUInt32LE(25, OFFSET_LON_DATA + 8); tiff.writeUInt32LE(1, OFFSET_LON_DATA + 12);
  tiff.writeUInt32LE(984, OFFSET_LON_DATA + 16); tiff.writeUInt32LE(100, OFFSET_LON_DATA + 20);

  const exifHeader = Buffer.from("Exif\0\0", "ascii");
  const segmentLength = 2 + exifHeader.length + tiff.length;
  const app1 = Buffer.alloc(2 + 2 + exifHeader.length + tiff.length);
  app1.writeUInt16BE(0xffe1, 0);
  app1.writeUInt16BE(segmentLength, 2);
  exifHeader.copy(app1, 4);
  tiff.copy(app1, 4 + exifHeader.length);

  return Buffer.concat([Buffer.from([0xff, 0xd8]), app1, Buffer.from([0xff, 0xd9])]);
}

test("registerPhotoWithExif rejects a photo with no EXIF timestamp/GPS instead of registering it", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const service = new EvidenceService(
    makeFakeRepository(calls) as never,
    makeFakeAudit() as never,
    makeFakeStorage(buildJpegWithExif(false)) as never,
  );

  await assert.rejects(
    () =>
      service.registerPhotoWithExif({
        tenantId: "t1", orgId: "o1", userId: "u1", roles: [], requestId: "r1",
        projectId: "proj_1", key: "some/key.jpg",
      }),
    /EXIF_INVALID/,
  );
  assert.equal(calls.length, 0);
});

test("registerPhotoWithExif populates geoLat/geoLng/capturedAt from the photo's own EXIF, not from request input", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const service = new EvidenceService(
    makeFakeRepository(calls) as never,
    makeFakeAudit() as never,
    makeFakeStorage(buildJpegWithExif(true)) as never,
  );

  await service.registerPhotoWithExif({
    tenantId: "t1", orgId: "o1", userId: "u1", roles: [], requestId: "r1",
    projectId: "proj_1", key: "some/key.jpg", category: "before_phase", description: "Roof prep",
  });

  assert.equal(calls.length, 1);
  const call = calls[0];
  assert.equal(call.kind, "PHOTO");
  assert.ok(Math.abs((call.geoLat as number) - 37.7749) < 0.0005);
  assert.ok(Math.abs((call.geoLng as number) - -122.4194) < 0.0005);
  assert.equal((call.capturedAt as Date).toISOString(), "2026-06-21T14:30:00.000Z");
  assert.equal(call.category, "before_phase");
  assert.equal(call.description, "Roof prep");
});
