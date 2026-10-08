/**
 * Provider-neutral signing boundary. A capability declaration is not an authorization
 * to execute: tenant scope, policy, approval and verified connection must be checked
 * by the caller before invoking a provider.
 */
export type SignatureProviderId = "hellosign" | "documenso" | "docusign";

export interface SignatureSigner {
  name: string;
  email: string;
  role: "client" | "professional";
}

export interface SignatureRequestInput {
  tenantId: string;
  contractId: string;
  idempotencyKey: string;
  title: string;
  documentText: string;
  signers: readonly SignatureSigner[];
}

export interface SignatureRequestReceipt {
  provider: SignatureProviderId;
  externalRequestId: string;
  status: "sent" | "pending";
  /** Never treat a request receipt as proof of signature completion. */
  completedDocumentRef: string | null;
}

export interface SignatureProviderCapabilities {
  embeddedSigning: boolean;
  cancellation: boolean;
  signedDocumentRetrieval: boolean;
  verifiedWebhooks: boolean;
}

export interface SignatureProvider {
  readonly id: SignatureProviderId;
  readonly capabilities: Readonly<SignatureProviderCapabilities>;
  createRequest(input: SignatureRequestInput): Promise<SignatureRequestReceipt>;
  getRequestStatus(externalRequestId: string): Promise<{
    status: "pending" | "partially_signed" | "completed" | "declined" | "cancelled";
    verifiedAt: string | null;
    completedDocumentRef: string | null;
  }>;
}

export class SignatureProviderRegistry {
  private readonly providers = new Map<SignatureProviderId, SignatureProvider>();

  register(provider: SignatureProvider): void {
    if (this.providers.has(provider.id)) {
      throw new Error(`Duplicate signature provider: ${provider.id}`);
    }
    this.providers.set(provider.id, provider);
  }

  resolve(id: SignatureProviderId): SignatureProvider {
    const provider = this.providers.get(id);
    if (!provider) throw new Error(`Signature provider not registered: ${id}`);
    return provider;
  }

  list(): ReadonlyArray<{ id: SignatureProviderId; capabilities: Readonly<SignatureProviderCapabilities> }> {
    return [...this.providers.values()].map(({ id, capabilities }) => ({ id, capabilities }));
  }
}
