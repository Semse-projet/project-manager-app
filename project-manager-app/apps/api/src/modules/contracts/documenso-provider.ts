import type {
  SignatureProvider,
  SignatureProviderCapabilities,
  SignatureRequestInput,
  SignatureRequestReceipt,
} from "./signature-provider.js";

/**
 * Documenso integration boundary. Deliberately disabled until the selected
 * Documenso release's envelope API, credentials, tenant mapping, webhook
 * verification, and durable request mapping have been implemented and tested.
 * Never fabricate a sent receipt or a completed signature.
 */
export class DocumensoProvider implements SignatureProvider {
  readonly id = "documenso" as const;
  readonly capabilities: Readonly<SignatureProviderCapabilities> = Object.freeze({
    embeddedSigning: false,
    cancellation: false,
    signedDocumentRetrieval: false,
    verifiedWebhooks: false,
  });

  async createRequest(input: SignatureRequestInput): Promise<SignatureRequestReceipt> {
    if (!input.tenantId?.trim() || !input.contractId?.trim() || !input.idempotencyKey?.trim()) {
      throw new Error("Documenso request requires tenant, contract, and idempotency scope");
    }
    if (!input.documentPdf?.byteLength || input.documentPdf.byteLength < 5 ||
      input.documentPdf[0] !== 0x25 || input.documentPdf[1] !== 0x50 ||
      input.documentPdf[2] !== 0x44 || input.documentPdf[3] !== 0x46 || input.documentPdf[4] !== 0x2d) {
      throw new Error("Documenso request requires a PDF document with a valid header");
    }
    if (!input.signers.length || input.signers.some(s => !s.email?.trim() || !s.fields?.length)) {
      throw new Error("Documenso request requires signers and PDF signature fields");
    }
    if (input.signers.some(s => s.fields?.some(f => !Number.isInteger(f.page) || f.page < 1 ||
      !Number.isFinite(f.positionX) || f.positionX < 0 ||
      !Number.isFinite(f.positionY) || f.positionY < 0 ||
      !Number.isFinite(f.width) || f.width <= 0 ||
      !Number.isFinite(f.height) || f.height <= 0))) {
      throw new Error("Documenso signature field coordinates are invalid");
    }
    throw new Error("Documenso provider is not configured for live signing");
  }

  async getRequestStatus(externalRequestId: string, context: { tenantId: string; contractId: string }): Promise<never> {
    if (!externalRequestId?.trim() || !context.tenantId?.trim() || !context.contractId?.trim()) {
      throw new Error("Documenso status requires tenant and contract scope");
    }
    throw new Error("Documenso status synchronization is not configured");
  }
}
