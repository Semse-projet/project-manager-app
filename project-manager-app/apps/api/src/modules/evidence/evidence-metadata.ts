import { BadRequestException } from "@nestjs/common";

/**
 * C67 — contrato validado de `metadataJson` para el registro canonico de
 * evidencia (EvidenceService.register / EvidenceRepository.create).
 *
 * El metadato son ANOTACIONES de cliente no confiables: nunca se usan para
 * autorizar ni para decidir tenant/proyecto/job, y NO pueden fijar campos que
 * el canonico gobierna (jobId, filename, category, description) ni las
 * columnas confiables (geo/fecha: solo desde EXIF via registerPhotoWithExif).
 */
export const MAX_EVIDENCE_METADATA_BYTES = 64 * 1024;
export const MAX_EVIDENCE_METADATA_DEPTH = 6;
export const RESERVED_EVIDENCE_METADATA_KEYS = ["jobId", "filename", "category", "description"] as const;
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function assertShape(value: unknown, depth: number): void {
  if (depth > MAX_EVIDENCE_METADATA_DEPTH) {
    throw new BadRequestException(`EVIDENCE_METADATA_INVALID: nesting deeper than ${MAX_EVIDENCE_METADATA_DEPTH}`);
  }
  if (Array.isArray(value)) {
    for (const item of value) assertShape(item, depth + 1);
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.has(key)) {
        throw new BadRequestException(`EVIDENCE_METADATA_INVALID: forbidden key '${key}'`);
      }
      assertShape(inner, depth + 1);
    }
    return;
  }
  if (typeof value === "function" || typeof value === "symbol" || typeof value === "bigint") {
    throw new BadRequestException("EVIDENCE_METADATA_INVALID: value is not JSON-serializable");
  }
}

/** Valida y devuelve una copia JSON-segura; `undefined` si no hay metadatos. */
export function parseEvidenceMetadata(input: unknown): Record<string, unknown> | undefined {
  if (input === undefined || input === null) return undefined;
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new BadRequestException("EVIDENCE_METADATA_INVALID: metadata must be a JSON object");
  }
  const record = input as Record<string, unknown>;
  for (const key of RESERVED_EVIDENCE_METADATA_KEYS) {
    if (key in record) {
      throw new BadRequestException(`EVIDENCE_METADATA_INVALID: '${key}' is reserved and set by the evidence service`);
    }
  }
  assertShape(record, 1);
  let serialized: string;
  try {
    serialized = JSON.stringify(record);
  } catch {
    throw new BadRequestException("EVIDENCE_METADATA_INVALID: value is not JSON-serializable");
  }
  if (Buffer.byteLength(serialized, "utf8") > MAX_EVIDENCE_METADATA_BYTES) {
    throw new BadRequestException(`EVIDENCE_METADATA_TOO_LARGE: more than ${MAX_EVIDENCE_METADATA_BYTES} bytes`);
  }
  return JSON.parse(serialized) as Record<string, unknown>;
}
