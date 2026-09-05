/**
 * m2.2-dispute-docs.spec.md Bloque 2.2.A — EXIF timestamp + GPS extraction
 * for photo evidence, so a contractor can't just type in a date/location
 * client-side ("Metric anti-disputa": timestamp/GPS come from the photo's
 * own EXIF bytes, not from request body fields).
 *
 * No external dependency: this is a minimal, from-scratch reader for the
 * one EXIF shape that matters here (JPEG APP1 → TIFF header → IFD0 →
 * ExifIFD.DateTimeOriginal, GPSIFD.GPSLatitude/GPSLongitude). It is not a
 * general-purpose EXIF library — anything it can't confidently parse
 * returns null so the caller fails closed instead of trusting a guess.
 */

export interface PhotoExifData {
  timestamp: Date;
  latitude: number;
  longitude: number;
}

const JPEG_SOI = 0xffd8;
const APP1_MARKER = 0xffe1;
const EXIF_HEADER = "Exif\0\0";

class ByteReader {
  constructor(
    private readonly buf: Buffer,
    private readonly littleEndian: boolean
  ) {}

  u16(offset: number): number {
    return this.littleEndian ? this.buf.readUInt16LE(offset) : this.buf.readUInt16BE(offset);
  }

  u32(offset: number): number {
    return this.littleEndian ? this.buf.readUInt32LE(offset) : this.buf.readUInt32BE(offset);
  }

  bytesAvailable(offset: number, length: number): boolean {
    return offset >= 0 && offset + length <= this.buf.length;
  }
}

interface IfdEntry {
  tag: number;
  type: number;
  count: number;
  valueOffset: number; // offset of the 4-byte value/offset field within the TIFF block
}

const TYPE_SIZES: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

function readIfd(reader: ByteReader, tiffStart: number, ifdOffset: number): { entries: IfdEntry[]; nextIfdOffset: number } | null {
  const absOffset = tiffStart + ifdOffset;
  if (!reader.bytesAvailable(absOffset, 2)) return null;

  const count = reader.u16(absOffset);
  const entries: IfdEntry[] = [];
  for (let i = 0; i < count; i++) {
    const entryOffset = absOffset + 2 + i * 12;
    if (!reader.bytesAvailable(entryOffset, 12)) return null;
    entries.push({
      tag: reader.u16(entryOffset),
      type: reader.u16(entryOffset + 2),
      count: reader.u32(entryOffset + 4),
      valueOffset: entryOffset + 8,
    });
  }

  const nextIfdFieldOffset = absOffset + 2 + count * 12;
  const nextIfdOffset = reader.bytesAvailable(nextIfdFieldOffset, 4) ? reader.u32(nextIfdFieldOffset) : 0;
  return { entries, nextIfdOffset };
}

function entryDataOffset(reader: ByteReader, tiffStart: number, entry: IfdEntry): number {
  const size = (TYPE_SIZES[entry.type] ?? 1) * entry.count;
  // Value fits inline in the 4-byte field only if <= 4 bytes; otherwise
  // that field holds an offset (relative to tiffStart) to the real data.
  return size <= 4 ? entry.valueOffset : tiffStart + reader.u32(entry.valueOffset);
}

function readAscii(reader: ByteReader, tiffStart: number, entry: IfdEntry, buf: Buffer): string | null {
  if (entry.type !== 2) return null;
  const dataOffset = entryDataOffset(reader, tiffStart, entry);
  if (!reader.bytesAvailable(dataOffset, entry.count)) return null;
  const raw = buf.subarray(dataOffset, dataOffset + entry.count).toString("ascii");
  return raw.replace(/\0+$/, "");
}

function readRational(reader: ByteReader, offset: number): number | null {
  if (!reader.bytesAvailable(offset, 8)) return null;
  const numerator = reader.u32(offset);
  const denominator = reader.u32(offset + 4);
  if (denominator === 0) return null;
  return numerator / denominator;
}

function readGpsCoordinate(reader: ByteReader, tiffStart: number, entry: IfdEntry): number | null {
  // GPSLatitude/GPSLongitude are RATIONAL[3]: degrees, minutes, seconds.
  if (entry.type !== 5 || entry.count !== 3) return null;
  const dataOffset = entryDataOffset(reader, tiffStart, entry);
  const degrees = readRational(reader, dataOffset);
  const minutes = readRational(reader, dataOffset + 8);
  const seconds = readRational(reader, dataOffset + 16);
  if (degrees == null || minutes == null || seconds == null) return null;
  return degrees + minutes / 60 + seconds / 3600;
}

function parseExifDateTime(value: string): Date | null {
  // "YYYY:MM:DD HH:MM:SS" per EXIF spec — not ISO 8601.
  const match = value.match(/^(\d{4}):(\d{2}):(\d{2})\s(\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, y, mo, d, h, mi, s] = match;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)));
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Extract DateTimeOriginal + GPS lat/lon from a JPEG buffer's EXIF (APP1)
 * segment. Returns null (never throws) for anything not confidently
 * parseable — non-JPEG input, missing APP1/GPS IFD, malformed offsets.
 */
export function parsePhotoExif(buf: Buffer): PhotoExifData | null {
  try {
    if (buf.length < 4 || buf.readUInt16BE(0) !== JPEG_SOI) return null;

    let offset = 2;
    while (offset + 4 <= buf.length) {
      const marker = buf.readUInt16BE(offset);
      if ((marker & 0xff00) !== 0xff00) break; // not a valid marker, stop scanning
      if (marker === 0xffd9 || marker === 0xffda) break; // EOI or start-of-scan — no more markers before image data

      const segmentLength = buf.readUInt16BE(offset + 2);
      if (marker === APP1_MARKER) {
        const headerStart = offset + 4;
        if (
          headerStart + EXIF_HEADER.length <= buf.length &&
          buf.toString("ascii", headerStart, headerStart + EXIF_HEADER.length) === EXIF_HEADER
        ) {
          const tiffStart = headerStart + EXIF_HEADER.length;
          return parseTiff(buf, tiffStart);
        }
      }
      offset += 2 + segmentLength;
    }
    return null;
  } catch {
    return null;
  }
}

function parseTiff(buf: Buffer, tiffStart: number): PhotoExifData | null {
  if (tiffStart + 8 > buf.length) return null;
  const byteOrderMarker = buf.toString("ascii", tiffStart, tiffStart + 2);
  if (byteOrderMarker !== "II" && byteOrderMarker !== "MM") return null;
  const littleEndian = byteOrderMarker === "II";
  const reader = new ByteReader(buf, littleEndian);

  const magic = reader.u16(tiffStart + 2);
  if (magic !== 0x002a) return null;

  const ifd0Offset = reader.u32(tiffStart + 4);
  const ifd0 = readIfd(reader, tiffStart, ifd0Offset);
  if (!ifd0) return null;

  const exifIfdEntry = ifd0.entries.find((e) => e.tag === 0x8769); // ExifIFDPointer
  const gpsIfdEntry = ifd0.entries.find((e) => e.tag === 0x8825); // GPSInfoIFDPointer
  if (!exifIfdEntry || !gpsIfdEntry) return null;

  const exifIfd = readIfd(reader, tiffStart, reader.u32(exifIfdEntry.valueOffset));
  const gpsIfd = readIfd(reader, tiffStart, reader.u32(gpsIfdEntry.valueOffset));
  if (!exifIfd || !gpsIfd) return null;

  const dateTimeEntry = exifIfd.entries.find((e) => e.tag === 0x9003); // DateTimeOriginal
  if (!dateTimeEntry) return null;
  const dateTimeRaw = readAscii(reader, tiffStart, dateTimeEntry, buf);
  const timestamp = dateTimeRaw ? parseExifDateTime(dateTimeRaw) : null;
  if (!timestamp) return null;

  const latEntry = gpsIfd.entries.find((e) => e.tag === 0x0002); // GPSLatitude
  const latRefEntry = gpsIfd.entries.find((e) => e.tag === 0x0001); // GPSLatitudeRef
  const lonEntry = gpsIfd.entries.find((e) => e.tag === 0x0004); // GPSLongitude
  const lonRefEntry = gpsIfd.entries.find((e) => e.tag === 0x0003); // GPSLongitudeRef
  if (!latEntry || !latRefEntry || !lonEntry || !lonRefEntry) return null;

  const latMagnitude = readGpsCoordinate(reader, tiffStart, latEntry);
  const lonMagnitude = readGpsCoordinate(reader, tiffStart, lonEntry);
  const latRef = readAscii(reader, tiffStart, latRefEntry, buf);
  const lonRef = readAscii(reader, tiffStart, lonRefEntry, buf);
  if (latMagnitude == null || lonMagnitude == null || !latRef || !lonRef) return null;

  const latitude = latRef.toUpperCase() === "S" ? -latMagnitude : latMagnitude;
  const longitude = lonRef.toUpperCase() === "W" ? -lonMagnitude : lonMagnitude;

  return { timestamp, latitude, longitude };
}
