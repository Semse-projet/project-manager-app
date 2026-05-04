import test from "node:test";
import assert from "node:assert/strict";
import { UsersService } from "../dist/modules/users/users.service.js";

function createService(existingProfile: Record<string, unknown> | null = null) {
  const calls = { upserts: [] as Record<string, unknown>[], audits: [] as Record<string, unknown>[] };

  const repository = {
    async findProfile() { return existingProfile; },
    async upsertProfile(userId: string, data: Record<string, unknown>) {
      calls.upserts.push({ userId, ...data });
      return { userId, trades: [], availability: true, updatedAt: new Date(), ...data };
    },
    async findUsersByTenant() { return []; },
    async findUserById() { return { id: "usr_x", email: "x@s.dev", status: "active", verificationStatus: "unverified", trustScore: 0, riskLevel: "low", flags: [], createdAt: new Date(), updatedAt: new Date() }; },
    async findMembershipsByUser() { return []; },
    async verifyUser() { return { id: "usr_x", email: "x@s.dev", status: "active", verificationStatus: "verified", trustScore: 0, riskLevel: "low", flags: [], createdAt: new Date(), updatedAt: new Date() }; },
    async updateUserStatus(input: Record<string, unknown>) { return { id: "usr_x", email: "x@s.dev", status: input.status, verificationStatus: "unverified", trustScore: 0, riskLevel: "low", flags: [], createdAt: new Date(), updatedAt: new Date() }; },
  };
  const auditService = { async append(e: Record<string, unknown>) { calls.audits.push(e); } };
  const domainEventBus = { async emit() {} };

  return {
    service: new UsersService(repository as never, auditService as never, domainEventBus as never),
    calls,
  };
}

const actor = { tenantId: "tnt_t", orgId: "org_t", userId: "usr_actor", roles: ["PRO"] };

test("getMyProfile returns empty profile when none exists", async () => {
  const { service } = createService(null);
  const profile = await service.getMyProfile(actor);
  assert.equal(profile.userId, "usr_actor");
  assert.deepEqual(profile.trades, []);
  assert.equal(profile.availability, true);
});

test("updateMyProfile upserts and audits", async () => {
  const { service, calls } = createService(null);
  const updated = await service.updateMyProfile({
    ...actor,
    data: { displayName: "Carlos Pro", bio: "10 años en electricidad", trades: ["Electricidad"], availability: true },
    requestId: "req_1"
  });
  assert.equal(updated.displayName, "Carlos Pro");
  assert.equal(calls.upserts.length, 1);
  assert.equal(calls.audits.length, 1);
  assert.equal(calls.audits[0]?.action, "user.profile.update");
});

test("updateMyProfile with empty displayName does not send it", async () => {
  const { service, calls } = createService(null);
  await service.updateMyProfile({ ...actor, data: { bio: "Solo bio" }, requestId: "req_2" });
  assert.equal(calls.upserts[0]?.displayName, undefined);
  assert.equal(calls.upserts[0]?.bio, "Solo bio");
});
