import {
  Controller,
  Get,
  BadRequestException,
  NotFoundException,
  Param,
  Put,
  Req,
  Res,
  StreamableFile,
  UnprocessableEntityException,
} from "@nestjs/common";
import type { IncomingMessage } from "node:http";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { Readable } from "node:stream";
import { StorageService } from "./storage.service.js";
import { buildTenantStorageKey, normalizeStorageDomain, normalizeStorageKey } from "./storage-key.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { Public } from "../../common/public.decorator.js";

const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "application/pdf",
  "application/zip",
  "text/plain",
  "application/octet-stream",
]);

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100MB
const SNIFF_BYTES = 32;

function isAllowedContentType(contentType: string): boolean {
  return ALLOWED_CONTENT_TYPES.has(contentType);
}

function hasSignature(buffer: Buffer, signature: number[], offset = 0): boolean {
  if (buffer.length < offset + signature.length) return false;
  return signature.every((byte, index) => buffer[offset + index] === byte);
}

function hasAscii(buffer: Buffer, value: string, offset = 0): boolean {
  return buffer.subarray(offset, offset + value.length).toString("ascii") === value;
}

function assertMagicBytes(contentType: string, buffer: Buffer): void {
  if (buffer.length === 0) {
    throw new UnprocessableEntityException("Empty uploads are not allowed");
  }

  switch (contentType) {
    case "image/jpeg":
      if (!hasSignature(buffer, [0xff, 0xd8, 0xff])) throw new UnprocessableEntityException("File content is not JPEG");
      return;
    case "image/png":
      if (!hasSignature(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
        throw new UnprocessableEntityException("File content is not PNG");
      }
      return;
    case "image/gif":
      if (!hasAscii(buffer, "GIF87a") && !hasAscii(buffer, "GIF89a")) {
        throw new UnprocessableEntityException("File content is not GIF");
      }
      return;
    case "image/webp":
      if (!hasAscii(buffer, "RIFF") || !hasAscii(buffer, "WEBP", 8)) {
        throw new UnprocessableEntityException("File content is not WEBP");
      }
      return;
    case "image/heic": {
      const brand = buffer.subarray(8, 16).toString("ascii");
      if (!hasAscii(buffer, "ftyp", 4) || !/(heic|heix|hevc|hevx|mif1|msf1)/.test(brand)) {
        throw new UnprocessableEntityException("File content is not HEIC");
      }
      return;
    }
    case "application/pdf":
      if (!hasAscii(buffer, "%PDF-")) throw new UnprocessableEntityException("File content is not PDF");
      return;
    case "application/zip":
      if (!hasSignature(buffer, [0x50, 0x4b, 0x03, 0x04]) && !hasSignature(buffer, [0x50, 0x4b, 0x05, 0x06])) {
        throw new UnprocessableEntityException("File content is not ZIP");
      }
      return;
    case "video/mp4":
    case "video/quicktime":
      if (!hasAscii(buffer, "ftyp", 4)) throw new UnprocessableEntityException("File content is not MP4/QuickTime");
      return;
    case "video/webm":
      if (!hasSignature(buffer, [0x1a, 0x45, 0xdf, 0xa3])) throw new UnprocessableEntityException("File content is not WebM");
      return;
    default:
      return;
  }
}

function validateUploadStream(
  stream: AsyncIterable<Buffer | Uint8Array | string>,
  contentType: string,
): Readable {
  async function* chunks() {
    const buffered: Buffer[] = [];
    let sniffedBytes = 0;
    let totalBytes = 0;
    let validated = false;

    for await (const chunk of stream) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.byteLength;
      if (totalBytes > MAX_UPLOAD_BYTES) {
        throw new UnprocessableEntityException(`File size exceeds maximum ${MAX_UPLOAD_BYTES}`);
      }

      if (!validated) {
        buffered.push(buffer);
        sniffedBytes += buffer.byteLength;
        if (sniffedBytes < SNIFF_BYTES) {
          continue;
        }
        const head = Buffer.concat(buffered);
        assertMagicBytes(contentType, head);
        validated = true;
        yield head;
        continue;
      }

      yield buffer;
    }

    if (!validated) {
      const head = Buffer.concat(buffered);
      assertMagicBytes(contentType, head);
      yield head;
    }
  }

  return Readable.from(chunks());
}

function headerValue(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const value = headers[name];
  return Array.isArray(value) ? value[0] : value;
}

@Controller("v1/uploads")
export class UploadsController {
  constructor(private readonly storageService: StorageService) {}

  /**
   * Presign a single-PUT upload key (returns a real local uploadUrl).
   * The client then PUTs the file body to that URL.
   */
  @Get("plan")
  @RequirePermissions("evidence:write")
  presignUploadPlan(
    @Req() req: { query?: Record<string, unknown>; headers?: Record<string, string | string[] | undefined> },
  ) {
    const filename = typeof req.query?.filename === "string" ? req.query.filename : "upload";
    const contentType = typeof req.query?.contentType === "string"
      ? req.query.contentType
      : "application/octet-stream";
    const baseType = contentType.split(";")[0].trim().toLowerCase();
    if (!isAllowedContentType(baseType)) {
      throw new UnprocessableEntityException(`Content-Type '${baseType}' is not allowed`);
    }

    const domain = normalizeStorageDomain(typeof req.query?.domain === "string" ? req.query.domain : "evidence");
    const tenantId = headerValue(req.headers ?? {}, "x-tenant-id") ?? "tenant_default";
    const key = buildTenantStorageKey({
      tenantId,
      domain,
      filename,
      nonce: randomUUID(),
      scope: "public-intake",
    });

    return this.storageService.putUploadPlan({ key, contentType: baseType });
  }

  /**
   * Accept a raw PUT body and store the file.
   * This is called by the client using the URL from the upload plan.
   */
  @Put("files/*")
  @RequirePermissions("evidence:write")
  async putFile(
    @Param("*") key: string,
    @Req() req: IncomingMessage & { headers: Record<string, string | string[] | undefined> },
  ) {
    const rawContentType = req.headers["content-type"] ?? "application/octet-stream";
    const contentType = Array.isArray(rawContentType) ? rawContentType[0] : rawContentType;

    const baseType = contentType.split(";")[0].trim().toLowerCase();
    if (!isAllowedContentType(baseType)) {
      throw new UnprocessableEntityException(`Content-Type '${baseType}' is not allowed`);
    }

    const rawLength = req.headers["content-length"];
    const length = rawLength ? parseInt(String(rawLength), 10) : undefined;
    if (length && length > MAX_UPLOAD_BYTES) {
      throw new UnprocessableEntityException(`File size ${length} exceeds maximum ${MAX_UPLOAD_BYTES}`);
    }

    let decodedKey: string;
    try {
      decodedKey = normalizeStorageKey(decodeURIComponent(key));
    } catch {
      throw new BadRequestException("Invalid storage key");
    }
    const stored = await this.storageService.store({
      key: decodedKey,
      stream: validateUploadStream(req, baseType),
      contentType: baseType,
    });

    return {
      ok: true,
      key: stored.key,
      sizeBytes: stored.sizeBytes,
      url: this.storageService.publicUrl(stored.key),
    };
  }

  /**
   * Serve a stored file by key.
   * Public — keys are tenant-scoped UUIDs (hard to enumerate).
   * PUT stays authenticated; GET is intentionally open so the vision service
   * and browsers can stream files without a session token.
   */
  @Public()
  @Get("files/*")
  async getFile(
    @Param("*") key: string,
    @Res({ passthrough: true }) res: { set(headers: Record<string, string>): void },
  ): Promise<StreamableFile> {
    let decodedKey: string;
    try {
      decodedKey = normalizeStorageKey(decodeURIComponent(key));
    } catch {
      throw new BadRequestException("Invalid storage key");
    }
    const { exists } = await this.storageService.stat(decodedKey);
    if (!exists) {
      throw new NotFoundException(`File '${decodedKey}' not found`);
    }

    const stream = this.storageService.createReadStream(decodedKey);
    const ext = path.extname(decodedKey).toLowerCase();
    const mimeMap: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".webp": "image/webp",
      ".gif": "image/gif",
      ".mp4": "video/mp4",
      ".mov": "video/quicktime",
      ".webm": "video/webm",
      ".pdf": "application/pdf",
    };
    const contentType = mimeMap[ext] ?? "application/octet-stream";

    const inlineTypes = contentType.startsWith("image/") || contentType.startsWith("video/") || contentType === "application/pdf";

    res.set({
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": `${inlineTypes ? "inline" : "attachment"}; filename="${path.basename(decodedKey).replace(/"/g, "")}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    });

    return new StreamableFile(stream);
  }
}
