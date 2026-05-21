import { Injectable, Logger } from "@nestjs/common";

// Dropbox Sign (formerly HelloSign) REST API — free tier supports 3 requests/month
const HELLOSIGN_API = "https://api.hellosign.com/v3";

export type SignerInfo = {
  name:  string;
  email: string;
  role:  "client" | "professional";
};

export type SignatureRequestResult = {
  requestId:        string;
  signingUrlClient: string | null;
  signingUrlPro:    string | null;
  embeddedEnabled:  boolean;
};

export type SignatureStatusResult = {
  requestId:    string;
  isComplete:   boolean;
  clientSigned: boolean;
  proSigned:    boolean;
  pdfUrl:       string | null;
};

@Injectable()
export class HelloSignService {
  private readonly logger = new Logger(HelloSignService.name);
  private readonly apiKey: string | null;

  constructor() {
    this.apiKey = process.env.HELLOSIGN_API_KEY?.trim() ?? null;
    if (!this.apiKey) {
      this.logger.warn("[HelloSign] HELLOSIGN_API_KEY not set — running in mock mode");
    }
  }

  /** 1.4.A: Create a signature request for a contract document. */
  async createSignatureRequest(input: {
    title:       string;
    subject:     string;
    message:     string;
    contractId:  string;
    documentText: string;
    signers:     SignerInfo[];
    clientId?:   string; // HelloSign app client_id for embedded signing
  }): Promise<SignatureRequestResult> {
    if (!this.apiKey) {
      return this.mockSignatureRequest(input.contractId, input.signers);
    }

    try {
      const formData = new FormData();
      formData.append("title", input.title);
      formData.append("subject", input.subject);
      formData.append("message", input.message);
      formData.append("test_mode", "1"); // sandbox until prod key

      // Encode document as file upload
      const blob = new Blob([input.documentText], { type: "text/plain" });
      formData.append("files[0]", blob, `contract_${input.contractId}.txt`);

      input.signers.forEach((signer, i) => {
        formData.append(`signers[${i}][name]`, signer.name);
        formData.append(`signers[${i}][email_address]`, signer.email);
        formData.append(`signers[${i}][order]`, String(i));
        formData.append(`signers[${i}][role]`, signer.role === "client" ? "Cliente" : "Contratista");
      });

      // Metadata
      formData.append(`metadata[semse_contract_id]`, input.contractId);

      const res = await fetch(`${HELLOSIGN_API}/signature_request/send`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.apiKey}:`).toString("base64")}`,
        },
        body: formData,
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        this.logger.warn(`[HelloSign] API error ${res.status}: ${txt.slice(0, 200)}`);
        return this.mockSignatureRequest(input.contractId, input.signers);
      }

      const data = (await res.json()) as {
        signature_request?: {
          signature_request_id: string;
          signatures: Array<{ signature_id: string; signer_email_address: string }>;
        };
      };

      const req = data.signature_request;
      if (!req) return this.mockSignatureRequest(input.contractId, input.signers);

      this.logger.log(`[HelloSign] Request created: ${req.signature_request_id}`);

      // For embedded signing, fetch embed URLs
      const sigUrls = await this.fetchEmbedUrls(req.signature_request_id, req.signatures, input.signers);

      return {
        requestId:        req.signature_request_id,
        signingUrlClient: sigUrls.client,
        signingUrlPro:    sigUrls.pro,
        embeddedEnabled:  Boolean(input.clientId),
      };
    } catch (err) {
      this.logger.warn(`[HelloSign] Request creation failed: ${(err as Error).message} — using mock`);
      return this.mockSignatureRequest(input.contractId, input.signers);
    }
  }

  /** Fetch embedded signing URLs (requires HelloSign app client_id) */
  private async fetchEmbedUrls(
    requestId: string,
    signatures: Array<{ signature_id: string; signer_email_address: string }>,
    signers: SignerInfo[],
  ): Promise<{ client: string | null; pro: string | null }> {
    let clientUrl: string | null = null;
    let proUrl:    string | null = null;

    for (const sig of signatures) {
      const signer = signers.find(s => s.email.toLowerCase() === sig.signer_email_address.toLowerCase());
      if (!signer) continue;

      try {
        const res = await fetch(`${HELLOSIGN_API}/embedded/sign_url/${sig.signature_id}`, {
          headers: {
            Authorization: `Basic ${Buffer.from(`${this.apiKey}:`).toString("base64")}`,
          },
          signal: AbortSignal.timeout(10_000),
        });
        if (res.ok) {
          const data = (await res.json()) as { embedded?: { sign_url?: string } };
          const url = data.embedded?.sign_url ?? null;
          if (signer.role === "client") clientUrl = url;
          else proUrl = url;
        }
      } catch {
        // ignore embed URL errors
      }
    }

    return { client: clientUrl, pro: proUrl };
  }

  /** Check signature request status */
  async getStatus(requestId: string): Promise<SignatureStatusResult> {
    if (!this.apiKey || requestId.startsWith("mock_")) {
      return { requestId, isComplete: false, clientSigned: false, proSigned: false, pdfUrl: null };
    }

    try {
      const res = await fetch(`${HELLOSIGN_API}/signature_request/${encodeURIComponent(requestId)}`, {
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.apiKey}:`).toString("base64")}`,
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) return { requestId, isComplete: false, clientSigned: false, proSigned: false, pdfUrl: null };

      const data = (await res.json()) as {
        signature_request?: {
          is_complete: boolean;
          signatures: Array<{ status_code: string; signer_role: string }>;
          files_url?: string;
        };
      };

      const req = data.signature_request;
      if (!req) return { requestId, isComplete: false, clientSigned: false, proSigned: false, pdfUrl: null };

      const clientSig = req.signatures.find(s => s.signer_role === "Cliente");
      const proSig    = req.signatures.find(s => s.signer_role === "Contratista");

      return {
        requestId,
        isComplete:   req.is_complete,
        clientSigned: clientSig?.status_code === "signed",
        proSigned:    proSig?.status_code === "signed",
        pdfUrl:       req.is_complete ? (req.files_url ?? null) : null,
      };
    } catch (err) {
      this.logger.warn(`[HelloSign] getStatus failed: ${(err as Error).message}`);
      return { requestId, isComplete: false, clientSigned: false, proSigned: false, pdfUrl: null };
    }
  }

  private mockSignatureRequest(contractId: string, signers: SignerInfo[]): SignatureRequestResult {
    const requestId = `mock_sr_${contractId}_${Date.now()}`;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.semse.io";
    const clientSigner = signers.find(s => s.role === "client");
    const proSigner    = signers.find(s => s.role === "professional");

    this.logger.debug(`[HelloSign] Mock request: ${requestId}`);
    return {
      requestId,
      signingUrlClient: clientSigner ? `${baseUrl}/contracts/sign?id=${contractId}&role=client&mock=1` : null,
      signingUrlPro:    proSigner    ? `${baseUrl}/contracts/sign?id=${contractId}&role=pro&mock=1`    : null,
      embeddedEnabled:  false,
    };
  }
}
