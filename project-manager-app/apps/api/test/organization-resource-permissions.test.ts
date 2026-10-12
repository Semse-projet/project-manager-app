import test from "node:test";
import assert from "node:assert/strict";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { OrganizationsRepository } from "../dist/modules/organizations/organizations.repository.js";

const actor = { userId: "usr_multi", tenantId: "tenant_one", orgId: "org_a", roles: ["PRO"] };
const organization = (id: string, roles: string[]) => ({
  id, tenantId: "tenant_one", type: "pro", name: id,
  createdAt: new Date(), updatedAt: new Date(),
  users: roles.map(key => ({ role: { key } }))
});

function fixture(targetRoles: string[]) {
  const operations: Array<{ kind: string; query: any }> = [];
  let roles = targetRoles;
  const repository = new OrganizationsRepository({
    org: {
      async findFirst(query: any) {
        operations.push({ kind: "org", query });
        // Visibility is a separate constraint from permission on the target.
        if (query.where.tenantId !== "tenant_one" || query.where.id === "org_hidden") return null;
        if (roles.length === 0 && query.where.users) return null;
        return organization(query.where.id, roles);
      },
      async findMany(query: any) {
        operations.push({ kind: "orgs", query });
        return [organization("org_a", ["PRO"]), organization("org_b", roles)];
      }
    },
    membership: {
      async findMany(query: any) {
        operations.push({ kind: "members", query });
        return [{userId:"usr_peer",orgId:"org_b",roleId:"role_worker",createdAt:new Date()}];
      }
    }
  } as never, {async ensureActorContext() {throw new Error("Read mutated identity");}} as never);
  return {repository, operations, setRoles(next: string[]) {roles = next;}};
}

test("DEC-R1: PRO in A cannot borrow org permission for a WORKER membership in B", async () => {
  const f = fixture(["WORKER"]);
  await assert.rejects(f.repository.findOrgById({...actor,targetOrgId:"org_b"}), ForbiddenException);
  await assert.rejects(f.repository.findMembershipsByOrg({...actor,targetOrgId:"org_b"}), ForbiddenException);
  assert.equal(f.operations.filter(x => x.kind === "members").length, 0);
});

test("DEC-R1: list excludes organizations whose current membership has no org:read", async () => {
  const f = fixture(["WORKER"]);
  assert.deepEqual((await f.repository.findOrgsByTenant(actor)).map(org => org.id), ["org_a"]);
});

test("DEC-R1: removing B's role takes effect without changing the valid session in A", async () => {
  const f = fixture(["PRO"]);
  assert.equal((await f.repository.findMembershipsByOrg({...actor,targetOrgId:"org_b"})).length, 1);
  f.setRoles(["WORKER"]);
  await assert.rejects(f.repository.findMembershipsByOrg({...actor,targetOrgId:"org_b"}), ForbiddenException);
  assert.equal(f.operations.filter(x => x.kind === "members").length, 1);
});

test("DEC-R1: independent authorized B roles work without changing the A cookie", async () => {
  const f = fixture(["CLIENT", "WORKER"]);
  const org = await f.repository.findOrgById({...actor,targetOrgId:"org_b"});
  assert.equal(org.id, "org_b");
  assert.equal("users" in org, false, "internal role projection must not leak into DTO");
  assert.equal((await f.repository.findMembershipsByOrg({...actor,targetOrgId:"org_b"})).length, 1);
});

test("DEC-R1: invisible or cross-tenant B remains 404 even for OPS_ADMIN", async () => {
  const f = fixture(["PRO"]);
  await assert.rejects(f.repository.findMembershipsByOrg({...actor,targetOrgId:"org_hidden"}), NotFoundException);
  await assert.rejects(f.repository.findMembershipsByOrg({...actor,roles:["OPS_ADMIN"],tenantId:"tenant_other",targetOrgId:"org_b"}), NotFoundException);
  assert.equal(f.operations.filter(x => x.kind === "members").length, 0);
});

test("DEC-R1: resource authorization selects only this user's ACTIVE target roles", async () => {
  const f = fixture(["PRO"]);
  await f.repository.findMembershipsByOrg({...actor,targetOrgId:"org_b"});
  assert.deepEqual(f.operations[0].query.include, {
    users: {where: {userId: actor.userId,status:"ACTIVE"},select: {role: {select: {key:true}}}}
  });
});

test("DEC-R1: existing OPS_ADMIN exception remains scoped to the actor tenant", async () => {
  const f = fixture([]);
  const result = await f.repository.findMembershipsByOrg({...actor,roles:["OPS_ADMIN"],targetOrgId:"org_b"});
  assert.equal(result.length, 1);
  assert.equal(f.operations[0].query.where.tenantId, actor.tenantId);
});
