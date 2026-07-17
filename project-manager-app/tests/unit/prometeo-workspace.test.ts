import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PROMETEO_ATTACHMENT_LIMITS,
  buildStoredPrometeoAttachment,
  classifyPrometeoAttachment,
  formatPrometeoAttachmentSize,
  getPrometeoAttachmentValidationError,
  getPrometeoUploadContentType,
  isPrometeoAttachmentAccepted,
} from "../../apps/web/components/ai/prometeo-attachments.ts";

function candidate(name: string, type: string, size = 1024) {
  return { name, type, size };
}

test("classifies Prometeo attachments by MIME and safe extension fallback", () => {
  assert.equal(classifyPrometeoAttachment(candidate("frente.webp", "image/webp")), "image");
  assert.equal(classifyPrometeoAttachment(candidate("avance.mp4", "video/mp4")), "video");
  assert.equal(classifyPrometeoAttachment(candidate("nota.m4a", "audio/mp4")), "audio");
  assert.equal(classifyPrometeoAttachment(candidate("contrato.pdf", "application/pdf")), "document");
  assert.equal(classifyPrometeoAttachment(candidate("mediciones.xlsx", "")), "file");
  assert.equal(classifyPrometeoAttachment(candidate("bitacora.md", "")), "document");
});

test("accepts operational formats and rejects active or executable content", () => {
  assert.equal(isPrometeoAttachmentAccepted(candidate("foto.jpg", "image/jpeg")), true);
  assert.equal(isPrometeoAttachmentAccepted(candidate("datos.csv", "text/csv")), true);
  assert.equal(isPrometeoAttachmentAccepted(candidate("planos.zip", "application/zip")), true);
  assert.equal(isPrometeoAttachmentAccepted(candidate("payload.html", "text/html")), false);
  assert.equal(isPrometeoAttachmentAccepted(candidate("vector.svg", "image/svg+xml")), false);
  assert.equal(isPrometeoAttachmentAccepted(candidate("installer.exe", "application/octet-stream")), false);
});

test("enforces per-file, quantity and total-size limits", () => {
  assert.match(
    getPrometeoAttachmentValidationError([
      candidate("large.mp4", "video/mp4", PROMETEO_ATTACHMENT_LIMITS.maxFileBytes + 1),
    ]) ?? "",
    /25 MB/,
  );

  assert.match(
    getPrometeoAttachmentValidationError(
      Array.from({ length: PROMETEO_ATTACHMENT_LIMITS.maxFiles + 1 }, (_, index) =>
        candidate(`foto-${index}.jpg`, "image/jpeg"),
      ),
    ) ?? "",
    /6 archivos/,
  );

  assert.match(
    getPrometeoAttachmentValidationError([
      candidate("a.mp4", "video/mp4", 25 * 1024 * 1024),
      candidate("b.mp4", "video/mp4", 25 * 1024 * 1024),
      candidate("c.txt", "text/plain", 1),
    ]) ?? "",
    /50 MB/,
  );
});

test("builds stored metadata without leaking File objects or blob URLs", () => {
  const attachment = buildStoredPrometeoAttachment({
    key: "tenant/evidence/video corto.mp4",
    name: "video corto.mp4",
    mimeType: "video/mp4",
    sizeBytes: 2_500_000,
    source: "camera",
  });

  assert.equal(attachment.type, "video");
  assert.equal(attachment.source, "camera");
  assert.equal(attachment.fileId, "tenant/evidence/video corto.mp4");
  assert.ok(attachment.url?.startsWith("/api/semse/uploads/files/"));
  assert.equal(attachment.url?.startsWith("blob:"), false);
  assert.deepEqual(attachment.metadata, {
    uploadStatus: "stored",
    analysisStatus: "pipeline_pending",
  });
  assert.equal("file" in attachment, false);
});

test("preserves clipboard source and formats sizes for the composer", () => {
  const attachment = buildStoredPrometeoAttachment({
    key: "tenant/evidence/captura.png",
    name: "captura.png",
    mimeType: "image/png",
    sizeBytes: 1536,
    source: "clipboard",
  });

  assert.equal(attachment.source, "clipboard");
  assert.equal(attachment.metadata?.analysisStatus, "stored");
  assert.equal(formatPrometeoAttachmentSize(1536), "1.5 KB");
});

test("normalizes unsupported safe formats for the existing storage allowlist", () => {
  assert.equal(getPrometeoUploadContentType(candidate("foto.jpg", "image/jpeg")), "image/jpeg");
  assert.equal(getPrometeoUploadContentType(candidate("voz.m4a", "audio/mp4")), "application/octet-stream");
  assert.equal(
    getPrometeoUploadContentType(candidate("informe.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")),
    "application/octet-stream",
  );
});

test("workspace exposes accessible file, camera, drop and paste controls", () => {
  const source = readFileSync(
    new URL("../../apps/web/components/ai/agent-chat-panel.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /aria-label="Seleccionar fotos, videos, audio o documentos"/);
  assert.match(source, /capture="environment"/);
  assert.match(source, /onDrop=/);
  assert.match(source, /onPaste=/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /<StructuredResponseCards/);
  assert.match(source, /safeCitationUrl\(citation\.url\)/);
});

test("upload proxy derives authorization server-side", () => {
  const source = readFileSync(
    new URL("../../apps/web/app/api/semse/uploads/files/[...key]/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /buildAuthorizedHeaders\(config\)/);
  assert.match(source, /\.\.\.authorizedHeaders/);
});
