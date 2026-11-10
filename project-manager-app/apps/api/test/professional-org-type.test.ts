/**
 * Sign-up and the seed store a professional's Org.type as the role key "PRO";
 * the actor-context and bid paths store "pro". The three lookups that resolve
 * a professional's org (reservations, contracts, trust) matched "pro" only, so
 * for every registered professional contract creation answered 409 "contract
 * requires an accepted reservation" even after the client accepted it.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { ContractsRepository } from "../dist/modules/contracts/contracts.repository.js";
import { ReservationsRepository } from "../dist/modules/reservations/reservations.repository.js";
import { TrustRepository } from "../dist/modules/trust/trust.repository.js";
import { PROFESSIONAL_ORG_TYPE_FILTER } from "../dist/common/org-type.js";

type Filter = string | { equals: string; mode?: "insensitive" | "default" };

// Same semantics as Prisma on PostgreSQL for a String column.
function matches(filter: Filter, value: string): boolean {
  if (typeof filter === "string") return filter === value;
  return filter.mode === "insensitive" ? filter.equals.toLowerCase() === value.toLowerCase() : filter.equals === value;
}

function prismaWithOrgs(orgs: Array<{ orgId: string; tenantId: string; type: string }>, seen: Filter[]) {
  return {
    membership: {
      async findFirst({ where }: { where: { userId: string; org: { tenantId: string; type: Filter } } }) {
        seen.push(where.org.type);
        const org = orgs.find((o) => o.tenantId === where.org.tenantId && matches(where.org.type, o.type));
        return org ? { orgId: org.orgId } : null;
      },
    },
  };
}

const actorContext = { async ensureActorContext() { return undefined; } };
const repositories = {
  reservations: (prisma: unknown) => new ReservationsRepository(prisma as never, actorContext as never),
  contracts: (prisma: unknown) => new ContractsRepository(prisma as never, actorContext as never, {} as never),
  trust: (prisma: unknown) => new TrustRepository(prisma as never, actorContext as never),
};

for (const [name, build] of Object.entries(repositories)) {
  for (const type of ["PRO", "pro", "Pro"]) {
    test(`${name}: resolves a professional org stored as type "${type}"`, async () => {
      const seen: Filter[] = [];
      const repo = build(prismaWithOrgs([{ orgId: "org_pro_1", tenantId: "tenant_1", type }], seen)) as unknown as {
        resolveProfessionalOrgId(tenantId: string, userId: string): Promise<string | null>;
      };
      assert.equal(await repo.resolveProfessionalOrgId("tenant_1", "usr_pro_1"), "org_pro_1");
      assert.deepEqual(seen, [PROFESSIONAL_ORG_TYPE_FILTER]);
    });
  }

  test(`${name}: still ignores client and ops orgs, and other tenants`, async () => {
    const repo = build(prismaWithOrgs([
      { orgId: "org_client_1", tenantId: "tenant_1", type: "CLIENT" },
      { orgId: "org_ops_1", tenantId: "tenant_1", type: "ops" },
      { orgId: "org_pro_other", tenantId: "tenant_2", type: "PRO" },
    ], [])) as unknown as { resolveProfessionalOrgId(tenantId: string, userId: string): Promise<string | null> };
    assert.equal(await repo.resolveProfessionalOrgId("tenant_1", "usr_pro_1"), null);
  });
}
