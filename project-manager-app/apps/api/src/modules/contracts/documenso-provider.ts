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
    if (!input.documentPdf?.byteLength) {
      throw new Error("Documenso request requires a validated PDF document");
    }
    if (!input.signers.length || input.signers.some(s => !s.email?.trim() || !s.fields?.length)) {
      throw new Error("Documenso request requires signers and PDF signature fields");
    }
    throw new Error("Documenso provider is not configured for live signing");
  }

  async getRequestStatus(_externalRequestId: string, context: { tenantId: string; contractId: string }): Promise<never> {
    if (!context.tenantId?.trim() || !context.contractId?.trim()) {
      throw new Error("Documenso status requires tenant and contract scope");
    }
    throw new Error("Documenso status synchronization is not configured");
  }
}
