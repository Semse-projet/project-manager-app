import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, lstat, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);
const MAX_SIGNED_PDF_BYTES = 25 * 1024 * 1024;
const SIGNATURE_HEADER = /^Signature #\d+:$/gm;
const STRONG_HASH = /^ - Signing Hash Algorithm: SHA-(?:256|384|512)$/m;

export type PdfSignatureTool = (
  binary: string,
  args: readonly string[],
  options: { timeout: number; maxBuffer: number; env: NodeJS.ProcessEnv },
) => Promise<{ stdout: string; stderr: string }>;

const nativePdfsig: PdfSignatureTool = async (binary, args, options) =>
  execFileAsync(binary, [...args], options);

/**
 * Independent cryptographic PDF signature/chain check using Poppler pdfsig.
 *
 * A trusted NSS certificate database with an approved Documenso CA chain is
 * mandatory. No -nocert / -no-ocsp shortcuts. pdfsig may return EXIT 0 even
 * when a PDF signature is invalid: we fail CLOSED on its verbose output.
 *
 * This proves the PDF's platform signature and trusted certificate only,
 * NOT that the particular client/professional consented or signed.
 * That identity/consent check must be independent and server-owned.
 */
export async function verifyPdfCmsSignature(
  signedPdf: Uint8Array,
  trustedNssDirectory: string,
  run: PdfSignatureTool = nativePdfsig,
): Promise<{ signedPdfSha256: string; signatureCount: number }> {
  if (!(signedPdf instanceof Uint8Array) || signedPdf.length < 8 ||
      signedPdf.length > MAX_SIGNED_PDF_BYTES ||
      Buffer.from(signedPdf.subarray(0, 5)).toString("ascii") !== "%PDF-") {
    throw new Error("missing or malformed signed PDF");
  }
  if (!trustedNssDirectory || !path.isAbsolute(trustedNssDirectory)) {
    throw new Error("trusted Documenso NSS certificate store must be configured");
  }
  const info = await lstat(trustedNssDirectory);
  if (!info.isDirectory() || info.isSymbolicLink()) {
    throw new Error("trusted certificate store must be a real directory");
  }
  const directory = await mkdtemp(path.join(tmpdir(), "semse-pdfsig-"));
  const file = path.join(directory, "signed.pdf");
  try {
    await writeFile(file, signedPdf, { mode: 0o600, flag: "wx" });
    const { stdout, stderr } = await run("pdfsig", ["-nssdir", trustedNssDirectory, file], {
      timeout: 15000, maxBuffer: 256 * 1024,
      env: { ...process.env, LANG: "C", LC_ALL: "C" },
    });
    if (typeof stdout !== "string" || stdout.length > 256 * 1024 ||
        (stderr && /error|failed|warning/i.test(stderr)) ||
        !stdout.includes("Digital Signature Info of:")) {
      throw new Error("pdfsig did not return a clean cryptographic verification report");
    }
    const blocks = stdout.split(SIGNATURE_HEADER).slice(1);
    if (blocks.length < 1 || blocks.length > 8) {
      throw new Error("signed PDF must have between one and eight certificates");
    }
    for (const block of blocks) {
      if (!STRONG_HASH.test(block) ||
          !/^ - Signature Validation: Signature is Valid\.$/m.test(block) ||
          !/^ - Certificate Validation: Certificate is Trusted\.$/m.test(block) ||
          !/^ - Total document signed$/m.test(block) ||
          /^ - Not total document signed$/m.test(block) ||
          !/^ - Signature Type: (?:adbe\.pkcs7\.detached|ETSI\.CAdES\.detached)$/m.test(block)) {
        throw new Error("PDF CMS signature, document coverage, digest or trust chain invalid");
      }
    }
    return {
      signedPdfSha256: createHash("sha256").update(signedPdf).digest("hex"),
      signatureCount: blocks.length,
    };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
