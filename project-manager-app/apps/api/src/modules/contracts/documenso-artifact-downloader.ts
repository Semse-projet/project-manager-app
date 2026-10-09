import { createHash } from "node:crypto";

/**
 * Read-only Documenso V2 retrieval for one completed envelope.
 * Mirrors documented GET /envelope/{id},
 * /envelope/item/{itemId}/download?version=signed,
 * /envelope/{id}/certificate/download and /audit-log/download.
 *
 * Authenticated transport and PDF byte checks are NOT PKI/CMS validation.
 * This service deliberately does not mark contracts VERIFIED_EXECUTED.
 */
export interface ScopedDocumensoEvidenceRequest {
  tenantId: string;
  connectionId: string;
  contractId: string;
  externalRequestId: string;
}

export interface DownloadedDocumensoEvidence {
  status: "UNVERIFIED_PROVIDER_BYTES";
  externalRequestId: string;
  signedPdf: Uint8Array;
  certificate: Uint8Array;
  auditLog: Uint8Array;
  signedPdfSha256: string;
  certificateSha256: string;
  auditLogSha256: string;
  recipients: readonly {
    id: string;
    email: string;
    signedAt: string;
  }[];
}

export interface DocumensoArtifactConfig {
  tenantId: string;
  connectionId: string;
  instanceOrigin: string;
  apiToken: string;
  outbox: {
    assertOwned(scope: {
      tenantId: string;
      connectionId: string;
      contractId: string;
      externalRequestId: string;
    }): Promise<void>;
  };
  fetchImpl?: typeof fetch;
}

const MAX_ARTIFACT_BYTES = 25 * 1024 * 1024;
const MAX_ENVELOPE_BYTES = 512 * 1024;
const ENVELOPE_ID = /^envelope_[A-Za-z0-9_-]{1,120}$/;
const ITEM_ID = /^[A-Za-z0-9_-]{1,120}$/;

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function readLimited(response: Response, limit: number): Promise<Uint8Array> {
  if (!response.ok) throw new Error(`Documenso authenticated download HTTP ${response.status}`);
  const contentLength = response.headers.get("content-length");
  if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > limit)) {
    throw new Error("Documenso download exceeds artifact size limit");
  }
  if (!response.body) throw new Error("Documenso download has no response body");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new Error("Documenso download exceeds artifact size limit");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const buffer = new Uint8Array(total);
  let position = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, position);
    position += chunk.byteLength;
  }
  return buffer;
}

function assertPdf(bytes: Uint8Array, kind: string): void {
  if (bytes.length < 8 ||
      Buffer.from(bytes.subarray(0, 5)).toString("ascii") !== "%PDF-") {
    throw new Error(`Documenso ${kind} is missing or is not a PDF`);
  }
}

export class DocumensoArtifactDownloader {
  private readonly baseUrl: string;
  private readonly http: typeof fetch;

  constructor(private readonly config: DocumensoArtifactConfig) {
    const origin = new URL(config.instanceOrigin);
    if (origin.protocol !== "https:" || origin.username || origin.password ||
        origin.search || origin.hash || origin.pathname !== "/" ||
        !config.apiToken || !config.tenantId || !config.connectionId ||
        typeof config.outbox?.assertOwned !== "function") {
      throw new Error("Documenso downloader needs a pinned HTTPS origin and scoped credentials");
    }
    this.baseUrl = `${origin.origin}/api/v2`;
    this.http = config.fetchImpl ?? fetch;
  }

  private async get(path: string, limit = MAX_ARTIFACT_BYTES): Promise<Uint8Array> {
    const response = await this.http(`${this.baseUrl}${path}`, {
      method: "GET", redirect: "error",
      headers: { Authorization: this.config.apiToken },
    });
    return readLimited(response, limit);
  }

  async download(scope: ScopedDocumensoEvidenceRequest): Promise<DownloadedDocumensoEvidence> {
    if (scope.tenantId !== this.config.tenantId ||
        scope.connectionId !== this.config.connectionId ||
        !scope.contractId || !ENVELOPE_ID.test(scope.externalRequestId)) {
      throw new Error("Documenso artifact request violates canonical scope");
    }

    await this.config.outbox.assertOwned(scope);
    const id = scope.externalRequestId;
    const envelopeBytes = await this.get(`/envelope/${id}`, MAX_ENVELOPE_BYTES);
    let envelope: {
      id?: unknown;
      status?: unknown;
      recipients?: unknown;
      envelopeItems?: unknown;
    };
    try {
      envelope = JSON.parse(Buffer.from(envelopeBytes).toString("utf8"));
    } catch {
      throw new Error("Documenso envelope metadata is malformed");
    }
    if (envelope?.id !== id || envelope.status !== "COMPLETED") {
      throw new Error("Documenso envelope is not canonical and completed");
    }
    if (!Array.isArray(envelope.envelopeItems) || envelope.envelopeItems.length !== 1) {
      throw new Error("Documenso evidence needs exactly one signed envelope item");
    }
    const itemId: unknown = envelope.envelopeItems[0]?.id;
    if (typeof itemId !== "string" || !ITEM_ID.test(itemId)) {
      throw new Error("Documenso envelope item identifier is invalid");
    }
    if (!Array.isArray(envelope.recipients) || envelope.recipients.length !== 2) {
      throw new Error("Documenso requires exactly two signed recipients");
    }
    const recipients = envelope.recipients.map((raw) => {
      const item = raw as Record<string, unknown>;
      if (item?.role !== "SIGNER" || item.signingStatus !== "SIGNED" ||
          !item.signedAt || !Number.isFinite(Date.parse(String(item.signedAt))) ||
          typeof item.email !== "string" || !item.email ||
          typeof item.id !== "number" && typeof item.id !== "string") {
        throw new Error("Documenso envelope recipients not fully signed");
      }
      return { id: String(item.id), email: item.email, signedAt: String(item.signedAt) };
    });
    if (new Set(recipients.map(r => r.id)).size !== 2 ||
        new Set(recipients.map(r => r.email.trim().toLowerCase())).size !== 2) {
      throw new Error("Documenso envelope has duplicated signer identities");
    }

    const signedPdf = await this.get(`/envelope/item/${itemId}/download?version=signed`);
    assertPdf(signedPdf, "signed document");
    const certificate = await this.get(`/envelope/${id}/certificate/download`);
    assertPdf(certificate, "completion certificate");
    const auditLog = await this.get(`/envelope/${id}/audit-log/download`);
    assertPdf(auditLog, "audit log");

    // Unverified bytes only: must bind to canonical users/consent/version and
    // separately validate embedded PDF signature, certificate and chain.
    return {
      status: "UNVERIFIED_PROVIDER_BYTES", externalRequestId: id,
      signedPdf, certificate, auditLog,
      signedPdfSha256: sha256(signedPdf),
      certificateSha256: sha256(certificate),
      auditLogSha256: sha256(auditLog),
      recipients,
    };
  }
}
