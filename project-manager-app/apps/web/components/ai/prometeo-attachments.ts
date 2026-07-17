import type {
  PrometeoAttachment,
  PrometeoAttachmentSource,
  PrometeoAttachmentType,
} from "@semse/schemas";

export const PROMETEO_ATTACHMENT_LIMITS = {
  maxFiles: 6,
  maxFileBytes: 25 * 1024 * 1024,
  maxTurnBytes: 50 * 1024 * 1024,
} as const;

export const PROMETEO_ATTACHMENT_ACCEPT = [
  "image/*",
  "video/*",
  "audio/*",
  ".pdf",
  ".txt",
  ".md",
  ".markdown",
  ".doc",
  ".docx",
  ".csv",
  ".xls",
  ".xlsx",
  ".zip",
].join(",");

export type PrometeoAttachmentCandidate = {
  name: string;
  type: string;
  size: number;
};

const DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const FILE_MIME_TYPES = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "application/x-zip-compressed",
]);

const DIRECT_UPLOAD_MIME_TYPES = new Set([
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
]);

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "bmp", "tif", "tiff"]);
const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "m4v", "webm", "avi"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "m4a", "aac", "ogg", "opus"]);
const DOCUMENT_EXTENSIONS = new Set(["pdf", "txt", "md", "markdown", "doc", "docx"]);
const FILE_EXTENSIONS = new Set(["csv", "xls", "xlsx", "zip"]);
const BLOCKED_EXTENSIONS = new Set([
  "app",
  "bat",
  "cmd",
  "com",
  "exe",
  "html",
  "htm",
  "js",
  "jar",
  "msi",
  "ps1",
  "sh",
  "svg",
]);

function extensionOf(name: string): string {
  const match = name.trim().toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

function normalizedMime(candidate: PrometeoAttachmentCandidate): string {
  return candidate.type.trim().toLowerCase().split(";", 1)[0] ?? "";
}

export function classifyPrometeoAttachment(
  candidate: PrometeoAttachmentCandidate,
): PrometeoAttachmentType {
  const mime = normalizedMime(candidate);
  const extension = extensionOf(candidate.name);

  if (mime.startsWith("image/") || IMAGE_EXTENSIONS.has(extension)) return "image";
  if (mime.startsWith("video/") || VIDEO_EXTENSIONS.has(extension)) return "video";
  if (mime.startsWith("audio/") || AUDIO_EXTENSIONS.has(extension)) return "audio";
  if (DOCUMENT_MIME_TYPES.has(mime) || DOCUMENT_EXTENSIONS.has(extension)) return "document";
  return "file";
}

export function isPrometeoAttachmentAccepted(
  candidate: PrometeoAttachmentCandidate,
): boolean {
  const mime = normalizedMime(candidate);
  const extension = extensionOf(candidate.name);

  if (!candidate.name.trim() || candidate.size <= 0 || BLOCKED_EXTENSIONS.has(extension)) {
    return false;
  }
  if (mime === "image/svg+xml" || mime === "text/html" || mime === "application/javascript") {
    return false;
  }
  if (mime.startsWith("image/") || mime.startsWith("video/") || mime.startsWith("audio/")) {
    return true;
  }
  return (
    DOCUMENT_MIME_TYPES.has(mime)
    || FILE_MIME_TYPES.has(mime)
    || IMAGE_EXTENSIONS.has(extension)
    || VIDEO_EXTENSIONS.has(extension)
    || AUDIO_EXTENSIONS.has(extension)
    || DOCUMENT_EXTENSIONS.has(extension)
    || FILE_EXTENSIONS.has(extension)
  );
}

export function getPrometeoAttachmentValidationError(
  candidates: readonly PrometeoAttachmentCandidate[],
): string | null {
  if (candidates.length > PROMETEO_ATTACHMENT_LIMITS.maxFiles) {
    return `Puedes adjuntar hasta ${PROMETEO_ATTACHMENT_LIMITS.maxFiles} archivos por turno.`;
  }

  for (const candidate of candidates) {
    if (!isPrometeoAttachmentAccepted(candidate)) {
      return `El archivo “${candidate.name || "sin nombre"}” no usa un formato permitido.`;
    }
    if (candidate.size > PROMETEO_ATTACHMENT_LIMITS.maxFileBytes) {
      return `“${candidate.name}” supera el límite de 25 MB para este compositor.`;
    }
  }

  const totalBytes = candidates.reduce((total, candidate) => total + candidate.size, 0);
  if (totalBytes > PROMETEO_ATTACHMENT_LIMITS.maxTurnBytes) {
    return "Los adjuntos del turno superan el límite total de 50 MB.";
  }

  return null;
}

export function formatPrometeoAttachmentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export function getPrometeoUploadContentType(
  candidate: PrometeoAttachmentCandidate,
): string {
  const mime = normalizedMime(candidate);
  return DIRECT_UPLOAD_MIME_TYPES.has(mime) ? mime : "application/octet-stream";
}

export function buildStoredPrometeoAttachment(input: {
  key: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  source: PrometeoAttachmentSource;
}): PrometeoAttachment {
  const type = classifyPrometeoAttachment({
    name: input.name,
    type: input.mimeType,
    size: input.sizeBytes,
  });

  return {
    id: `attachment:${input.key}`,
    fileId: input.key,
    type,
    source: input.source,
    name: input.name,
    mimeType: input.mimeType || "application/octet-stream",
    sizeBytes: input.sizeBytes,
    url: `/api/semse/uploads/files/${encodeURIComponent(input.key)}`,
    metadata: {
      uploadStatus: "stored",
      analysisStatus: type === "video" || type === "audio" ? "pipeline_pending" : "stored",
    },
  };
}
