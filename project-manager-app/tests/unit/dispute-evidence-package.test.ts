import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  buildDisputePackageUploadInput,
  disputePackageProxyUrl,
  resolveDisputePackagePlan,
} from "../../apps/web/lib/dispute-evidence-package.ts";

const workspaceSource = readFileSync(
  "apps/web/app/components/disputes/DisputeResolutionWorkspace.tsx",
  "utf8",
);

test("dispute package planning uses metadata from the selected file", () => {
  assert.deepEqual(
    buildDisputePackageUploadInput({
      name: "evidence-bundle.zip",
      size: 4_096,
      type: "application/zip",
    }),
    {
      domain: "dispute",
      filename: "evidence-bundle.zip",
      contentType: "application/zip",
      fileSizeBytes: 4_096,
      source: "local_device",
    },
  );
  assert.equal(
    buildDisputePackageUploadInput({
      name: "scan.bin",
      size: 1,
      type: "",
    }).contentType,
    "application/octet-stream",
  );
});

test("empty files and simulated multipart plans fail explicitly", () => {
  assert.throws(
    () => buildDisputePackageUploadInput({ name: "empty.zip", size: 0, type: "application/zip" }),
    /vacío|inválido/i,
  );
  assert.throws(
    () => resolveDisputePackagePlan({ recommendedStrategy: "external_transfer", key: "ignored" }),
    /multipart.*no envía bytes reales/i,
  );
  assert.throws(
    () => resolveDisputePackagePlan({ recommendedStrategy: "single_put" }),
    /clave de almacenamiento válida/i,
  );
});

test("single-put plans keep the real key and an encoded BFF URL", () => {
  assert.deepEqual(
    resolveDisputePackagePlan({
      recommendedStrategy: "single_put",
      key: "tenants/t-1/dispute/file name.zip",
      contentType: "application/zip",
    }),
    {
      key: "tenants/t-1/dispute/file name.zip",
      contentType: "application/zip",
    },
  );
  assert.equal(
    disputePackageProxyUrl("tenants/t-1/dispute/file name.zip"),
    "/api/semse/uploads/files/tenants%2Ft-1%2Fdispute%2Ffile%20name.zip",
  );
});

test("workspace selects a File and PUTs its real bytes without fake multipart completion", () => {
  const failedPutGuard = workspaceSource.indexOf("if (!uploadResponse.ok)");
  const successState = workspaceSource.indexOf("setUploadedPackageKey(key)");

  assert.match(workspaceSource, /type="file"/);
  assert.match(workspaceSource, /buildDisputePackageUploadInput\(file\)/);
  assert.match(workspaceSource, /body:\s*file/);
  assert.match(workspaceSource, /disputePackageProxyUrl\(key\)/);
  assert.ok(failedPutGuard >= 0 && successState > failedPutGuard);
  assert.match(workspaceSource, /uploadedPackageKey \? \(/);
  assert.doesNotMatch(workspaceSource, /etag-part-/);
  assert.doesNotMatch(workspaceSource, /Completar sesión multipart/);
  assert.doesNotMatch(workspaceSource, /uploadSizeMb/);
});
