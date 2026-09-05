import test from "node:test";
import assert from "node:assert/strict";
import { parsePhotoExif } from "../dist/modules/evidence/evidence-exif.js";

/**
 * Builds a minimal valid JPEG (SOI + APP1/Exif + EOI) with a
 * DateTimeOriginal + GPSLatitude/GPSLongitude, little-endian TIFF, so
 * parsePhotoExif can be tested without any real camera photo or an
 * external EXIF library (there is no such dependency in this repo —
 * m2.2-dispute-docs.spec.md Bloque 2.2.A implements EXIF reading from
 * scratch, see evidence-exif.ts).
 */
function buildJpegWithExif(opts: {
  dateTime?: string; // "YYYY:MM:DD HH:MM:SS", omit for no DateTimeOriginal tag
  lat?: { deg: number; min: number; secNumerator: number; secDenominator: number; ref: "N" | "S" };
  lon?: { deg: number; min: number; secNumerator: number; secDenominator: number; ref: "E" | "W" };
  includeGpsIfd?: boolean; // default true when lat/lon given
}): Buffer {
  const hasDateTime = opts.dateTime !== undefined;
  const hasGps = opts.includeGpsIfd !== false && opts.lat && opts.lon;

  const ifd0EntryCount = hasGps ? 2 : 1; // always ExifIFDPointer; GPSInfoIFDPointer only if hasGps
  const OFFSET_IFD0 = 8;
  const LEN_IFD0 = 2 + ifd0EntryCount * 12 + 4;
  const OFFSET_EXIF_IFD = OFFSET_IFD0 + LEN_IFD0;
  const exifEntryCount = hasDateTime ? 1 : 0;
  const LEN_EXIF_IFD = 2 + exifEntryCount * 12 + 4;
  const OFFSET_EXIF_DATA = OFFSET_EXIF_IFD + LEN_EXIF_IFD;
  const dateTimeBytes = hasDateTime ? Buffer.from(`${opts.dateTime}\0`, "ascii") : Buffer.alloc(0);
  const LEN_EXIF_DATA = dateTimeBytes.length;

  const OFFSET_GPS_IFD = OFFSET_EXIF_DATA + LEN_EXIF_DATA;
  const gpsEntryCount = hasGps ? 4 : 0;
  const LEN_GPS_IFD = hasGps ? 2 + gpsEntryCount * 12 + 4 : 0;
  const OFFSET_LAT_DATA = OFFSET_GPS_IFD + LEN_GPS_IFD;
  const OFFSET_LON_DATA = OFFSET_LAT_DATA + (hasGps ? 24 : 0);
  const TOTAL_TIFF_LEN = OFFSET_LON_DATA + (hasGps ? 24 : 0);

  const tiff = Buffer.alloc(TOTAL_TIFF_LEN);
  tiff.write("II", 0, "ascii");
  tiff.writeUInt16LE(0x002a, 2);
  tiff.writeUInt32LE(OFFSET_IFD0, 4);

  // IFD0
  let p = OFFSET_IFD0;
  tiff.writeUInt16LE(ifd0EntryCount, p);
  p += 2;
  tiff.writeUInt16LE(0x8769, p); // ExifIFDPointer
  tiff.writeUInt16LE(4, p + 2);
  tiff.writeUInt32LE(1, p + 4);
  tiff.writeUInt32LE(OFFSET_EXIF_IFD, p + 8);
  p += 12;
  if (hasGps) {
    tiff.writeUInt16LE(0x8825, p); // GPSInfoIFDPointer
    tiff.writeUInt16LE(4, p + 2);
    tiff.writeUInt32LE(1, p + 4);
    tiff.writeUInt32LE(OFFSET_GPS_IFD, p + 8);
    p += 12;
  }
  tiff.writeUInt32LE(0, p); // next IFD offset

  // ExifIFD
  p = OFFSET_EXIF_IFD;
  tiff.writeUInt16LE(exifEntryCount, p);
  p += 2;
  if (hasDateTime) {
    tiff.writeUInt16LE(0x9003, p); // DateTimeOriginal
    tiff.writeUInt16LE(2, p + 2); // ASCII
    tiff.writeUInt32LE(dateTimeBytes.length, p + 4);
    tiff.writeUInt32LE(OFFSET_EXIF_DATA, p + 8);
    p += 12;
  }
  tiff.writeUInt32LE(0, p);
  dateTimeBytes.copy(tiff, OFFSET_EXIF_DATA);

  // GPSIFD
  if (hasGps) {
    p = OFFSET_GPS_IFD;
    tiff.writeUInt16LE(gpsEntryCount, p);
    p += 2;
    tiff.writeUInt16LE(0x0001, p); // GPSLatitudeRef
    tiff.writeUInt16LE(2, p + 2);
    tiff.writeUInt32LE(2, p + 4);
    tiff.write(`${opts.lat!.ref}\0`, p + 8, "ascii");
    p += 12;
    tiff.writeUInt16LE(0x0002, p); // GPSLatitude
    tiff.writeUInt16LE(5, p + 2);
    tiff.writeUInt32LE(3, p + 4);
    tiff.writeUInt32LE(OFFSET_LAT_DATA, p + 8);
    p += 12;
    tiff.writeUInt16LE(0x0003, p); // GPSLongitudeRef
    tiff.writeUInt16LE(2, p + 2);
    tiff.writeUInt32LE(2, p + 4);
    tiff.write(`${opts.lon!.ref}\0`, p + 8, "ascii");
    p += 12;
    tiff.writeUInt16LE(0x0004, p); // GPSLongitude
    tiff.writeUInt16LE(5, p + 2);
    tiff.writeUInt32LE(3, p + 4);
    tiff.writeUInt32LE(OFFSET_LON_DATA, p + 8);
    p += 12;
    tiff.writeUInt32LE(0, p);

    tiff.writeUInt32LE(opts.lat!.deg, OFFSET_LAT_DATA);
    tiff.writeUInt32LE(1, OFFSET_LAT_DATA + 4);
    tiff.writeUInt32LE(opts.lat!.min, OFFSET_LAT_DATA + 8);
    tiff.writeUInt32LE(1, OFFSET_LAT_DATA + 12);
    tiff.writeUInt32LE(opts.lat!.secNumerator, OFFSET_LAT_DATA + 16);
    tiff.writeUInt32LE(opts.lat!.secDenominator, OFFSET_LAT_DATA + 20);

    tiff.writeUInt32LE(opts.lon!.deg, OFFSET_LON_DATA);
    tiff.writeUInt32LE(1, OFFSET_LON_DATA + 4);
    tiff.writeUInt32LE(opts.lon!.min, OFFSET_LON_DATA + 8);
    tiff.writeUInt32LE(1, OFFSET_LON_DATA + 12);
    tiff.writeUInt32LE(opts.lon!.secNumerator, OFFSET_LON_DATA + 16);
    tiff.writeUInt32LE(opts.lon!.secDenominator, OFFSET_LON_DATA + 20);
  }

  const exifHeader = Buffer.from("Exif\0\0", "ascii");
  const segmentLength = 2 + exifHeader.length + tiff.length;
  const app1 = Buffer.alloc(2 + 2 + exifHeader.length + tiff.length);
  app1.writeUInt16BE(0xffe1, 0);
  app1.writeUInt16BE(segmentLength, 2);
  exifHeader.copy(app1, 4);
  tiff.copy(app1, 4 + exifHeader.length);

  const soi = Buffer.from([0xff, 0xd8]);
  const eoi = Buffer.from([0xff, 0xd9]);
  return Buffer.concat([soi, app1, eoi]);
}

const SF_LAT = { deg: 37, min: 46, secNumerator: 2964, secDenominator: 100, ref: "N" as const };
const SF_LON = { deg: 122, min: 25, secNumerator: 984, secDenominator: 100, ref: "W" as const };

test("parsePhotoExif extracts DateTimeOriginal and GPS from a valid EXIF JPEG", () => {
  const jpeg = buildJpegWithExif({ dateTime: "2026:06:21 14:30:00", lat: SF_LAT, lon: SF_LON });

  const result = parsePhotoExif(jpeg);

  assert.ok(result);
  assert.equal(result!.timestamp.toISOString(), "2026-06-21T14:30:00.000Z");
  assert.ok(Math.abs(result!.latitude - 37.7749) < 0.0005, `latitude was ${result!.latitude}`);
  assert.ok(Math.abs(result!.longitude - -122.4194) < 0.0005, `longitude was ${result!.longitude}`);
});

test("parsePhotoExif applies S/W refs as negative coordinates", () => {
  const jpeg = buildJpegWithExif({
    dateTime: "2026:06:21 14:30:00",
    lat: { ...SF_LAT, ref: "S" },
    lon: { ...SF_LON, ref: "E" },
  });

  const result = parsePhotoExif(jpeg);

  assert.ok(result);
  assert.ok(result!.latitude < 0);
  assert.ok(result!.longitude > 0);
});

test("parsePhotoExif returns null for a non-JPEG buffer", () => {
  assert.equal(parsePhotoExif(Buffer.from("not a jpeg at all")), null);
});

test("parsePhotoExif returns null when there is no APP1/Exif segment", () => {
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.from([0xff, 0xd9])]);
  assert.equal(parsePhotoExif(jpeg), null);
});

test("parsePhotoExif returns null when GPS IFD is missing (fails closed, does not guess)", () => {
  const jpeg = buildJpegWithExif({ dateTime: "2026:06:21 14:30:00", includeGpsIfd: false });
  assert.equal(parsePhotoExif(jpeg), null);
});

test("parsePhotoExif returns null when DateTimeOriginal is missing", () => {
  const jpeg = buildJpegWithExif({ lat: SF_LAT, lon: SF_LON });
  assert.equal(parsePhotoExif(jpeg), null);
});

test("parsePhotoExif returns null for a truncated/corrupt EXIF block instead of throwing", () => {
  const jpeg = buildJpegWithExif({ dateTime: "2026:06:21 14:30:00", lat: SF_LAT, lon: SF_LON });
  const truncated = jpeg.subarray(0, jpeg.length - 40);
  assert.doesNotThrow(() => parsePhotoExif(truncated));
  assert.equal(parsePhotoExif(truncated), null);
});
