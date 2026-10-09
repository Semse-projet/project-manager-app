import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { verifyPdfCmsSignature } from "../dist/modules/contracts/pdf-cms-signature-verifier.js";

const signedPdf = Buffer.from("%PDF-1.7\nMock bytes for CLI injection only\n%%EOF");
const validReport = `Digital Signature Info of: /tmp/signed.pdf
Signature #1:
 - Signer Certificate Common Name: SEMSE test instance
 - Signer full Distinguished Name: CN=SEMSE test instance
 - Signing Time: Oct 09 2026 06:00:00
 - Signing Hash Algorithm: SHA-256
 - Signature Type: adbe.pkcs7.detached
 - Signed Ranges: [0 - 100], [200 - 400]
 - Total document signed
 - Signature Validation: Signature is Valid.
 - Certificate Validation: Certificate is Trusted.
`;

async function withNss(fn: (path: string) => Promise<void>) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "semse-pdfsig-nss-"));
  try { await fn(dir); } finally { await rm(dir, { force: true, recursive: true }); }
}

test("accepts only strong fully covered PKCS7 with trusted issuer", async () => {
  await withNss(async (nss) => {
    let calls = 0;
    const result = await verifyPdfCmsSignature(signedPdf, nss, async (binary, args, opts) => {
      calls++;
      assert.equal(binary, "pdfsig");
      assert.equal(args[0], "-nssdir");
      assert.equal(args[1], nss);
      assert.match(args[2]!, /signed\.pdf$/);
      assert.ok(!args.includes("-nocert") && !args.includes("-no-ocsp"));
      assert.equal(opts.timeout, 15000);
      return { stdout: validReport, stderr: "" };
    });
    assert.equal(calls, 1);
    assert.equal(result.signatureCount, 1);
    assert.equal(result.signedPdfSha256, createHash("sha256").update(signedPdf).digest("hex"));
  });
});

test("strict validator rejects tampered, weak, untrusted, unsigned and partially covered PDFs", async () => {
  const badOutputs = [
    validReport.replace("Signature is Valid.", "Digest Mismatch."),
    validReport.replace("Certificate is Trusted.", "Certificate issuer is unknown."),
    validReport.replace("Total document signed", "Not total document signed"),
    validReport.replace("SHA-256", "SHA1"),
    validReport.replace("adbe.pkcs7.detached", "adbe.pkcs7.sha1"),
    validReport.replace("Certificate is Trusted.", "Certificate has been Revoked."),
    validReport.replace("Digital Signature Info of: /tmp/signed.pdf", "No signature"),
    validReport.replace("Signature #1:", "Unknown Section"),
  ];
  await withNss(async (nss) => {
    for (const stdout of badOutputs) {
      await assert.rejects(
        verifyPdfCmsSignature(signedPdf, nss, async () => ({ stdout, stderr: "" })),
        /invalid|clean cryptographic|between one and eight/,
      );
    }
  });
});

test("one invalid signature in a multi-signature PDF rejects the whole document", async () => {
  await withNss(async (nss) => {
    const stdout = validReport + validReport.slice(validReport.indexOf("Signature #1:"))
      .replace("Signature #1:", "Signature #2:")
      .replace("Certificate is Trusted.", "Certificate has Expired.");
    await assert.rejects(verifyPdfCmsSignature(signedPdf, nss,
      async () => ({ stdout, stderr: "" })), /invalid/);
  });
});

test("no trusted store, missing PDF, tool failure and verification diagnostics fail closed", async () => {
  await assert.rejects(verifyPdfCmsSignature(signedPdf, "", async () => ({
    stdout: validReport, stderr: "",
  })), /trusted Documenso NSS/);
  await withNss(async (nss) => {
    await assert.rejects(verifyPdfCmsSignature(Buffer.from("not pdf"), nss), /malformed/);
    await assert.rejects(verifyPdfCmsSignature(signedPdf, nss,
      async () => { throw Error("pdfsig unavailable"); }), /unavailable/);
    await assert.rejects(verifyPdfCmsSignature(signedPdf, nss,
      async () => ({ stdout: validReport, stderr: "warning: untrusted CA" })), /clean cryptographic/);
  });
});
