import test from "node:test";
import assert from "node:assert/strict";
import {
  inspectFieldMemoryStorage,
  readMountPoints,
} from "../../scripts/field-memory-storage-preflight.mjs";

const valid = {
  NODE_ENV: "production",
  STORAGE_PROVIDER: "local",
  SEMSE_STORAGE_ROOT: "/data/semse-storage",
  SEMSE_MULTIPART_STORAGE_ROOT: "/data/semse-storage/multipart",
  UPLOADS_SIGNED_GET_MODE: "enforce",
  AUTH_SECRET: "a".repeat(40),
  UPLOADS_SIGNING_SECRET: "b".repeat(40),
  EVIDENCE_ORIGINAL_SHA256_MODE: "enforce",
};

function inspect(env = valid, extra = {}) {
  return inspectFieldMemoryStorage({
    env,
    mountInfo: "10 1 8:1 / / rw - overlay overlay rw\n11 1 8:2 / /data rw - ext4 /dev/mock rw\n",
    rootExists: true,
    rootWritable: true,
    multipartExists: true,
    multipartWritable: true,
    ...extra,
  });
}
const pick = (result, id) => result.checks.find((c) => c.id === id)?.status;

test("mountinfo parser checks the actual mount point, not just / root", () => {
  assert.ok(readMountPoints("10 1 8:2 / /data rw - ext4 /dev/mock rw").has("/data"));
  assert.ok(!readMountPoints("10 1 8:2 / / rw - overlay overlay rw").has("/data"));
  assert.ok(readMountPoints("10 1 8:2 / /data\\040files rw - ext4 /dev/mock rw").has("/data files"));
});

test("valid Railway layout can pass path checks without claiming a backup or Org permission", () => {
  const p = inspect();
  assert.equal(p.storageLayoutReady, true);
  assert.equal(p.privateCaptureReady, false);
  assert.equal(p.readOnly, true);
  assert.equal(pick(p, "offsite-backup-restore"), "UNVERIFIED");
  assert.equal(pick(p, "resource-level-read-auth"), "UNVERIFIED");
});

test("storage mistakenly pointed at ephemeral tmp is a blocking failure", () => {
  const p = inspect({ ...valid, SEMSE_STORAGE_ROOT: "/tmp/semse-storage" });
  assert.equal(p.storageLayoutReady, false);
  assert.equal(pick(p, "original-root-scope"), "BLOCK");
  assert.equal(pick(p, "multipart-root-scope"), "BLOCK");
});

test("multipart root must be under the volume and under the original root", () => {
  const p = inspect({ ...valid, SEMSE_MULTIPART_STORAGE_ROOT: "/data/different/multipart" });
  assert.equal(p.storageLayoutReady, false);
  assert.equal(pick(p, "multipart-root-scope"), "BLOCK");
});

test("missing distinct /data mount cannot be inferred from an ordinary directory", () => {
  const p = inspect(valid, { mountInfo: "10 1 8:1 / / rw - overlay overlay rw" });
  assert.equal(pick(p, "railway-volume-mount"), "BLOCK");
});

test("unsigned read mode is not a verified private capture deployment", () => {
  const p = inspect({ ...valid, UPLOADS_SIGNED_GET_MODE: "off", UPLOADS_SIGNING_SECRET: undefined });
  assert.equal(pick(p, "signed-mode-active"), "WARN");
  assert.equal(pick(p, "signing-secret-configured"), "WARN");
  assert.equal(p.privateCaptureReady, false);
});

test("report never echoes credentials, signed URLs or original file keys", () => {
  const secret = "very-secret-value-dont-print-123";
  const p = inspect({ ...valid, UPLOADS_SIGNING_SECRET: secret });
  const printed = JSON.stringify(p);
  assert.ok(!printed.includes(secret));
  assert.ok(!printed.includes(valid.AUTH_SECRET));
  assert.ok(!printed.includes("/data/semse-storage/multipart"));
  assert.ok(!printed.includes("evidence/my-photo.jpg"));
});


test("server checksum mode off cannot certify original provenance", () => {
  const result=inspect({...valid,EVIDENCE_ORIGINAL_SHA256_MODE:undefined});
  assert.equal(pick(result,"server-original-sha256-enforced"),"WARN");
  assert.equal(result.privateCaptureReady,false);
});
test("invalid checksum mode is blocking even with a correctly mounted volume", () => {
  const result=inspect({...valid,EVIDENCE_ORIGINAL_SHA256_MODE:"enabled"});
  assert.equal(pick(result,"server-original-sha256-mode-known"),"BLOCK");
  assert.equal(result.privateCaptureReady,false);
});
test("enforced hash mode is necessary but not sufficient for capture readiness", () => {
  const result=inspect();
  assert.equal(pick(result,"server-original-sha256-mode-known"),"PASS");
  assert.equal(pick(result,"server-original-sha256-enforced"),"PASS");
  assert.equal(result.privateCaptureReady,false);
});
