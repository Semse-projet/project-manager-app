import { createHash } from "node:crypto";
import PDFDocument from "pdfkit";
import { z } from "zod";
import type { ContractTermsJson } from "./contract-template.service.js";
import { ContractTemplateService } from "./contract-template.service.js";

const email = z.string().email().max(320);
const bounded = z.string().min(1).max(16000);
const partySchema = z.object({
  clientName: z.string().min(1).max(200), clientEmail: email,
  proName: z.string().min(1).max(200), proEmail: email,
  projectTitle: z.string().min(1).max(500),
  totalAmount: z.number().nonnegative().finite(), currency: z.string().min(3).max(3),
  startDate: z.string().min(1).max(100),
  zipCode: z.string().max(30).optional(),
}).passthrough();
const legalTerms = z.object({
  trade: bounded, templateVersion: bounded,
  parties: partySchema,
  scope: bounded, materials: z.array(bounded).max(100),
  milestones: z.array(z.object({
    title: bounded, amount: z.number().nonnegative().finite(),
    description: bounded,
  }).passthrough()).max(150),
  totalAmount: z.number().nonnegative().finite(),
  warranty: bounded, permits: bounded, disputeClause: bounded,
  changeOrders: bounded, generatedAt: z.string().min(1).max(100),
}).passthrough();

export type OriginalContractPdfInput = {
  tenantId: string;
  contractId: string;
  jobId: string;
  clientUserId: string;
  professionalUserId: string;
  clientEmail: string;
  professionalEmail: string;
  termsJson: unknown;
};

const MAX_SOURCE_CHARS = 100_000;
const MAX_ORIGINAL_PDF_BYTES = 25 * 1024 * 1024;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, canonicalize(item)]));
  }
  return value;
}

function verifyInput(input: OriginalContractPdfInput): {
  legalText: string;
  sourceAppendix: string;
  digest: string;
} {
  if (!input.tenantId || !input.contractId || !input.jobId ||
      !input.clientUserId || !input.professionalUserId ||
      input.clientUserId === input.professionalUserId) {
    throw new Error("canonical PDF requires two distinct scoped contracting parties");
  }
  const terms = legalTerms.parse(input.termsJson);
  if (terms.parties.clientEmail.trim().toLowerCase() !== input.clientEmail.trim().toLowerCase() ||
      terms.parties.proEmail.trim().toLowerCase() !== input.professionalEmail.trim().toLowerCase() ||
      terms.parties.clientEmail.trim().toLowerCase() === terms.parties.proEmail.trim().toLowerCase() ||
      !Number.isFinite(Date.parse(terms.generatedAt))) {
    throw new Error("contract template does not match the two canonical account identities");
  }
  const sourceAppendix = JSON.stringify(canonicalize(input.termsJson));
  if (sourceAppendix.length > MAX_SOURCE_CHARS) {
    throw new Error("canonical contract terms exceed the safe PDF rendering limit");
  }
  const digest = createHash("sha256").update(sourceAppendix, "utf8").digest("hex");
  const legalText = new ContractTemplateService().toPlainText(terms as ContractTermsJson);
  return { legalText, sourceAppendix, digest };
}

/**
 * Generates the ORIGINAL PDF entirely from stored, server-scoped contract terms.
 * No documentHash, client-supplied pdfUrl or external PDF bytes are accepted.
 * In addition to the human-readable contract, the full canonical terms JSON is
 * included as an appendix so future fields cannot silently disappear.
 *
 * The exact *PDF bytes*, not this JSON digest, must be stored and hashed once.
 * Rendering is NOT evidence of signer consent, PDF CMS or provider completion.
 */
export async function renderCanonicalContractPdf(input: OriginalContractPdfInput): Promise<Uint8Array> {
  const { legalText, sourceAppendix, digest } = verifyInput(input);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER", margin: 54, compress: true,
      info: {
        Title: `SEMSE Contract ${input.contractId}`,
        Author: "SEMSE Project", Subject: "Immutable canonical contract original",
        Keywords: "SEMSE contract original",
      },
    });
    const parts: Buffer[] = [];
    let bytes = 0;
    let failed = false;
    doc.on("error", reject);
    doc.on("data", (part: Buffer) => {
      bytes += part.length;
      if (bytes > MAX_ORIGINAL_PDF_BYTES) {
        failed = true;
        doc.destroy(new Error("canonical PDF exceeds artifact size limit"));
        return;
      }
      parts.push(part);
    });
    doc.on("end", () => {
      if (failed) return;
      resolve(new Uint8Array(Buffer.concat(parts)));
    });
    doc.font("Helvetica-Bold").fontSize(15).text("SEMSE PROJECT — CONTRATO CANÓNICO", { align: "center" });
    doc.moveDown();
    doc.font("Helvetica").fontSize(9).text(`Contract ID: ${input.contractId}\nJob ID: ${input.jobId}\nOriginal terms SHA-256: ${digest}\nClient ID: ${input.clientUserId}\nProfessional ID: ${input.professionalUserId}`);
    doc.moveDown();
    doc.fontSize(10).text(legalText, { lineGap: 3 });
    doc.addPage();
    doc.font("Helvetica-Bold").fontSize(12).text("ANEXO — SNAPSHOT ÍNTEGRO DE LOS TÉRMINOS");
    doc.moveDown();
    doc.font("Courier").fontSize(7).text(sourceAppendix, { lineGap: 2 });
    doc.end();
  });
}
