import { createHash, timingSafeEqual } from "node:crypto";
import type {
  SignatureProvider,
  SignatureProviderCapabilities,
  SignatureRequestInput,
  SignatureRequestReceipt,
  SignatureFieldPlacement,
} from "./signature-provider.js";

export interface SignatureRequestKey {
  tenantId: string;
  connectionId: string;
  contractId: string;
  idempotencyKey: string;
  /** Hash of canonical immutable PDF + signer payload; duplicate key changes are forbidden. */
  requestFingerprint: string;
}

export interface DocumensoOutbox {
  /**
   * Atomically reserve a unique (tenant, contract, idempotencyKey).
   * Reject duplicates, including attempts following ambiguous network failures.
   */
  reserve(key: SignatureRequestKey): Promise<void>;
  /** Persist the external draft identifier before any distribution attempt. */
  created(key: SignatureRequestKey & { externalRequestId: string }): Promise<void>;
  /** Persist the successful distribution receipt. */
  sent(key: SignatureRequestKey & { externalRequestId: string }): Promise<void>;
  /** Prove the queried envelope belongs to this tenant/contract before polling. */
  assertOwned(key: { tenantId: string; connectionId: string; contractId: string; externalRequestId: string }): Promise<void>;
}

export interface DocumensoProviderConfig {
  tenantId: string;
  connectionId: string;
  /** Fixed, trusted instance origin; must be HTTPS. Never accept from an HTTP request. */
  instanceUrl: string;
  apiToken: string;
  webhookSecret: string;
  /** Server-owned policy/approval decision, checked both before draft and distribution. */
  assertSendAuthorized(input: SignatureRequestInput): Promise<void>;
  assertStatusAuthorized(context: { tenantId: string; connectionId: string; contractId: string }): Promise<void>;
  outbox: DocumensoOutbox;
  fetchImpl?: typeof fetch;
}

/**
 * Experimental Documenso V2 envelope adapter. Deliberately not registered in
 * ContractsModule, so this class alone cannot send any live signature traffic.
 *
 * The caller must supply a durable outbox and ADR-042 policy/approval gate.
 * Never auto-retry create or distribute on uncertain outcomes: reconcile first.
 */
export class DocumensoSignatureProvider implements SignatureProvider {
  readonly id = "documenso" as const;
  readonly capabilities: Readonly<SignatureProviderCapabilities> = Object.freeze({
    embeddedSigning: false,
    cancellation: false,
    signedDocumentRetrieval: false,
    // Header comparison exists, but no durable, authorized event handler yet.
    verifiedWebhooks: false,
  });

  private readonly apiBase: string;
  private readonly http: typeof fetch;

  constructor(private readonly config: DocumensoProviderConfig) {
    const url = new URL(config.instanceUrl);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") {
      throw new Error("Documenso requires a fixed HTTPS instance origin");
    }
    if (!config.tenantId || !config.connectionId || !config.apiToken || !config.webhookSecret ||
        typeof config.assertSendAuthorized !== "function" ||
        typeof config.assertStatusAuthorized !== "function" ||
        typeof config.outbox?.reserve !== "function" ||
        typeof config.outbox?.created !== "function" ||
        typeof config.outbox?.sent !== "function" ||
        typeof config.outbox?.assertOwned !== "function") {
      throw new Error("Documenso connection, approval gate, or outbox not configured");
    }
    this.apiBase = `${url.origin}/api/v2`;
    this.http = config.fetchImpl ?? fetch;
  }

  /** Documenso uses an exact, shared-secret header, not a signed-body HMAC. */
  verifyWebhookSecret(header: string | null | undefined): boolean {
    if (!header || !this.config.webhookSecret) return false;
    const actual = Buffer.from(header, "utf8");
    const expected = Buffer.from(this.config.webhookSecret, "utf8");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  async createRequest(input: SignatureRequestInput): Promise<SignatureRequestReceipt> {
    this.assertInput(input);
    const requestFingerprint = createHash("sha256")
      .update(Buffer.from(input.documentPdf!))
      .update(JSON.stringify([input.title, input.signers]))
      .digest("hex");
    const key: SignatureRequestKey = {
      tenantId: input.tenantId,
      connectionId: input.connectionId,
      contractId: input.contractId,
      idempotencyKey: input.idempotencyKey,
      requestFingerprint,
    };

    // Authorization is a mandatory *server-side* hook; merely supplying input does
    // not grant permission. Durable reservation precedes all provider side effects.
    await this.config.assertSendAuthorized(input);
    await this.config.outbox.reserve(key);

    const externalId = "semse-" + createHash("sha256")
      .update(JSON.stringify([input.tenantId, input.connectionId, input.contractId, input.idempotencyKey]))
      .digest("hex");

    const form = new FormData();
    form.append("payload", JSON.stringify({
      type: "DOCUMENT",
      title: input.title,
      externalId,
      recipients: input.signers.map((signer) => ({
        email: signer.email,
        name: signer.name,
        role: "SIGNER",
        fields: signer.fields!.map((field) => ({
          identifier: 0,
          type: "SIGNATURE",
          ...field,
        })),
      })),
    }));
    form.append(
      "files",
      new Blob([new Uint8Array(input.documentPdf!)], { type: "application/pdf" }),
      `contract-${encodeURIComponent(input.contractId)}.pdf`,
    );

    const created = await this.request("POST", "/envelope/create", form) as { id?: unknown };
    if (typeof created.id !== "string" || !created.id.startsWith("envelope_")) {
      throw new Error("Documenso create response missing envelope ID; reconcile before retrying");
    }
    const externalRequestId = created.id;
    await this.config.outbox.created({ ...key, externalRequestId });

    // Never distribute drafts without a fresh approval. Drafts left by a revoked
    // approval must be reconciled/cancelled by a separate operator workflow.
    await this.config.assertSendAuthorized(input);
    const distributed = await this.request("POST", "/envelope/distribute", JSON.stringify({
      envelopeId: externalRequestId,
    })) as { id?: unknown; success?: unknown };
    if (distributed.success !== true || distributed.id !== externalRequestId) {
      throw new Error("Documenso distribution is unconfirmed; reconcile before retrying");
    }
    await this.config.outbox.sent({ ...key, externalRequestId });

    return {
      provider: "documenso",
      externalRequestId,
      status: "sent",
      completedDocumentRef: null,
    };
  }

  async getRequestStatus(
    externalRequestId: string,
    context: { tenantId: string; connectionId: string; contractId: string },
  ): ReturnType<SignatureProvider["getRequestStatus"]> {
    if (!externalRequestId.startsWith("envelope_")) throw new Error("Invalid Documenso envelope ID");
    if (!context || context.tenantId !== this.config.tenantId ||
        context.connectionId !== this.config.connectionId || !context.contractId) {
      throw new Error("Documenso status tenant/contract scope mismatch");
    }
    await this.config.assertStatusAuthorized(context);
    await this.config.outbox.assertOwned({ ...context, externalRequestId });
    const envelope = await this.request(
      "GET", `/envelope/${encodeURIComponent(externalRequestId)}`,
    ) as {
      id?: unknown;
      status?: unknown;
      completedAt?: unknown;
      recipients?: Array<{ signingStatus?: unknown }>;
    };
    if (envelope.id !== externalRequestId) throw new Error("Documenso envelope mismatch");
    const completedDocumentRef = null; // Do not claim a signed artifact before fetching/verifying it.
    switch (envelope.status) {
      case "PENDING":
        return {
          status: envelope.recipients?.some((x) => x.signingStatus === "SIGNED")
            ? "partially_signed" : "pending",
          verifiedAt: null,
          completedDocumentRef,
        };
      case "COMPLETED":
        return {
          status: "completed",
          verifiedAt: typeof envelope.completedAt === "string" ? envelope.completedAt : null,
          completedDocumentRef,
        };
      case "REJECTED":
        return { status: "declined", verifiedAt: null, completedDocumentRef };
      case "CANCELLED":
        return { status: "cancelled", verifiedAt: null, completedDocumentRef };
      default:
        throw new Error("Documenso envelope is draft or has an unknown status");
    }
  }

  private assertInput(input: SignatureRequestInput): void {
    if (input.tenantId !== this.config.tenantId ||
        input.connectionId !== this.config.connectionId ||
        !input.contractId || !input.idempotencyKey || !input.title ||
        !input.signers?.length || !input.documentPdf ||
        input.documentPdf.length < 14 ||
        input.documentPdf.length > 15 * 1024 * 1024 ||
        Buffer.from(input.documentPdf.subarray(0, 5)).toString("ascii") !== "%PDF-" ||
        !Buffer.from(input.documentPdf.subarray(-2048)).includes(Buffer.from("%%EOF"))) {
      throw new Error("Documenso request requires a tenant-scoped PDF and signing data");
    }
    for (const signer of input.signers) {
      if (!signer.email || !signer.name || !signer.fields?.length) {
        throw new Error("Documenso requires explicit signer positions");
      }
      for (const field of signer.fields as readonly SignatureFieldPlacement[]) {
        if (!Number.isInteger(field.page) || field.page < 1 ||
            ![field.positionX, field.positionY, field.width, field.height]
              .every((n) => Number.isFinite(n) && n >= 0 && n <= 100) ||
            field.width <= 0 || field.height <= 0 ||
            field.positionX + field.width > 100 ||
            field.positionY + field.height > 100) {
          throw new Error("Documenso invalid signature field position");
        }
      }
    }
  }

  private async request(method: "GET" | "POST", path: string, body?: FormData | string): Promise<unknown> {
    const response = await this.http(`${this.apiBase}${path}`, {
      method,
      headers: {
        Authorization: this.config.apiToken,
        ...(typeof body === "string" ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body } : {}),
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      // Do not print sensitive provider responses, signer data, or credentials.
      throw new Error(`Documenso API returned HTTP ${response.status}; reconcile before retrying`);
    }
    try {
      return await response.json();
    } catch {
      throw new Error("Documenso API response invalid; reconcile before retrying");
    }
  }
}
