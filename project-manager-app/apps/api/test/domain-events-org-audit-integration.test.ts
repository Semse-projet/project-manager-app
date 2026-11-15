/**
 * #1156: DomainEvent audit organization isolation against disposable PostgreSQL.
 * No Railway DBs, no production, no payments and no token issuance.
 */
import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { AuditService } from "../dist/infrastructure/audit/audit.service.js";
import { DomainEventsRepository } from "../dist/modules/domain-events/domain-events.repository.js";

function disposableDb(): boolean {
  const raw = process.env.DATABASE_URL;
  if (!raw) return false;
  let url: URL;
  try { url = new URL(raw); } catch { return false; }
  if (!["postgresql:", "postgres:"].includes(url.protocol)
      || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
      || url.port !== "5433") return false;
  const db = decodeURIComponent(url.pathname.slice(1));
  if (process.env.GITHUB_ACTIONS === "true") {
    return process.env.CI === "true" && url.hostname === "127.0.0.1"
      && url.username === "semse" && db === "semse";
  }
  return process.env.SEMSE_ALLOW_DISPOSABLE_AGENT_CLAIM_DB === "1"
    && /^semse_(test|e2e)(?:_|$)/.test(db);
}
if (process.env.SEMSE_ALLOW_DISPOSABLE_AGENT_CLAIM_DB === "1" && !disposableDb())
  throw new Error("DomainEvent audit ownership tests require disposable local Postgres :5433");
const dbTest = disposableDb() ? test : test.skip;
const prisma = new PrismaClient();
const context = { async ensureActorContext() {} };
const audit = new AuditService(prisma as never, context as never);
const events = new DomainEventsRepository(prisma as never, context as never);
const unique = (prefix: string) => prefix + "_" + randomUUID().replaceAll("-", "");

dbTest("#1156: audit emits owner and list/trace hide other orgs and legacy rows", async () => {
  const tenantId = unique("tenant"), otherTenantId = unique("tenant");
  const orgA = unique("org"), orgB = unique("org"), orgC = unique("org");
  const userA = unique("user"), userB = unique("user"), userC = unique("user");
  const correlation = unique("corr");
  const correlationExtended = correlation + "_partial";
  await prisma.tenant.createMany({ data: [
    { id: tenantId, slug: tenantId, name: "Disposable audit QA" },
    { id: otherTenantId, slug: otherTenantId, name: "Other tenant" },
  ] });
  await prisma.org.createMany({ data: [
    { id: orgA, tenantId, name: "A", type: "CLIENT" },
    { id: orgB, tenantId, name: "B", type: "CLIENT" },
    { id: orgC, tenantId: otherTenantId, name: "C", type: "CLIENT" },
  ] });
  await prisma.user.createMany({ data: [userA,userB,userC].map(id =>
    ({ id, email: id+"@example.invalid", status: "active" })) });
  const owned = async (tenant: string, org: string, user: string, corr: string) =>
    audit.append({
      tenantId: tenant, orgId: org, actorUserId: user,
      action: "domain.event.emit", entityType: "DomainEvent",
      entityId: "qa.event:" + corr,
      requestId: unique("req"), timestamp: new Date().toISOString(),
      afterJson: { type: "qa.event", meta: { correlationId: corr }, payload: {synthetic: true} },
    });
  try {
    await owned(tenantId, orgA, userA, correlation);
    await owned(tenantId, orgB, userB, correlation);
    await owned(tenantId, orgA, userA, correlationExtended);
    await owned(otherTenantId, orgC, userC, correlation);
    await prisma.auditLog.create({ data: {
      tenantId, actorUserId: userA, action: "domain.event.emit",
      entityType: "DomainEvent", entityId: "qa.event:" + correlation,
      afterJson: { type: "qa.event", payload: { legacyOwner: "unknown" } },
    } });
    const A = { tenantId, orgId: orgA, userId: userA };
    const B = { tenantId, orgId: orgB, userId: userB };
    const C = { tenantId: otherTenantId, orgId: orgC, userId: userC };
    const allA = await events.listDomainEventAuditRows({ ...A, limit: 100 });
    const allB = await events.listDomainEventAuditRows({ ...B, limit: 100 });
    assert.equal(allA.length, 2, "A sees only own verified events");
    assert.equal(allB.length, 1, "B sees only own verified events");
    const corrA = await events.listDomainEventAuditRowsByCorrelationId({ ...A, correlationId: correlation });
    const corrB = await events.listDomainEventAuditRowsByCorrelationId({ ...B, correlationId: correlation });
    const corrC = await events.listDomainEventAuditRowsByCorrelationId({ ...C, correlationId: correlation });
    assert.equal(corrA.length, 1, "A excludes B, unknown legacy owner and prefix collisions");
    assert.equal(corrB.length, 1);
    assert.equal(corrC.length, 1, "cross-tenant event cannot enter A/B trace");
  } finally {
    await prisma.auditLog.deleteMany({where:{tenantId:{in:[tenantId,otherTenantId]}}});
    await prisma.user.deleteMany({where:{id:{in:[userA,userB,userC]}}});
    await prisma.org.deleteMany({where:{id:{in:[orgA,orgB,orgC]}}});
    await prisma.tenant.deleteMany({where:{id:{in:[tenantId,otherTenantId]}}});
  }
});

test.after(async () => { await prisma.$disconnect(); });
