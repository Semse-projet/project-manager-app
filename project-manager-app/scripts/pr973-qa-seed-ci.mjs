/**
 * PR #973 authenticated QA identities for a disposable GitHub Actions database.
 * Never run against Railway or production. Random credentials exist only in
 * this single CI job and must not be committed, logged, or uploaded.
 */
import assert from "node:assert/strict";
import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import { appendFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

assert.equal(process.env.CI, "true", "Only GitHub CI may seed PR973 QA identities");
assert.equal(process.env.SEMSE_PR973_E2E_QA, "1", "Explicit PR973 QA opt-in is required");
assert.equal(process.env.NODE_ENV, "test", "QA seed must run with NODE_ENV=test");
assert.ok(process.env.GITHUB_ENV, "GitHub environment file is required");
const url = new URL(process.env.DATABASE_URL ?? "");
assert.equal(url.hostname, "127.0.0.1", "QA database must be localhost");
assert.equal(url.port, "5433", "QA database must be on isolated CI port 5433");
assert.equal(url.pathname, "/semse", "Unexpected QA database");
assert.equal(process.env.RAILWAY_ENVIRONMENT, undefined, "Railway is not a QA seed target");
assert.equal(process.env.RAILWAY_ENVIRONMENT_NAME, undefined, "Railway is not a QA seed target");

const suffix = randomUUID().replaceAll("-", "").slice(0, 14);
const tenantId = "test_pr973_tenant_" + suffix;
const password = randomBytes(32).toString("base64url");
const salt = randomBytes(16);
const passwordHash = "s1$" + salt.toString("base64url") + "$" +
  scryptSync(password, salt, 64).toString("base64url");
const users = [
  { name: "ADMIN", role: "OPS_ADMIN" },
  { name: "CLIENT", role: "CLIENT" },
  { name: "WORKER", role: "PRO" },
];
const prisma = new PrismaClient();
try {
  await prisma.tenant.create({
    data: { id: tenantId, slug: "test-pr973-" + suffix, name: "Ephemeral PR973 QA", status: "active" },
  });
  for (const actor of users) {
    const role = await prisma.role.upsert({
      where: { key: actor.role },
      update: {},
      create: { key: actor.role, name: actor.role },
    });
    const org = await prisma.org.create({
      data: {
        id: "test_pr973_org_" + actor.name.toLowerCase() + "_" + suffix,
        tenantId,
        type: actor.role.toLowerCase(),
        name: "Ephemeral PR973 " + actor.name,
      },
    });
    const email = "qa-pr973-" + actor.name.toLowerCase() + "-" + suffix + "@example.invalid";
    const user = await prisma.user.create({
      data: {
        id: "test_pr973_user_" + actor.name.toLowerCase() + "_" + suffix,
        email,
        passwordHash,
        status: "active",
        verificationStatus: "verified",
      },
    });
    await prisma.membership.create({
      data: { userId: user.id, orgId: org.id, roleId: role.id, status: "ACTIVE" },
    });
    appendFileSync(process.env.GITHUB_ENV, "SEMSE_QA_" + actor.name + "_EMAIL=" + email + "\n");
    appendFileSync(process.env.GITHUB_ENV, "SEMSE_QA_" + actor.name + "_PASSWORD=" + password + "\n");
  }
  // Mask both the plaintext password and signed auth secrets in Actions logs.
  process.stdout.write("::add-mask::" + password + "\n");
  console.log("PR973 QA: created three isolated DB identities (OPS_ADMIN, CLIENT, PRO); credentials redacted");
} finally {
  await prisma.$disconnect();
}
