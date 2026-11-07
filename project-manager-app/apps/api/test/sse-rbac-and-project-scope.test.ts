import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { setImmediate as tick } from "node:timers/promises";
import { Reflector } from "@nestjs/core";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { SseController } from "../dist/infrastructure/sse/sse.controller.js";
import { SseEventBusService } from "../dist/infrastructure/sse/sse-event-bus.service.js";
import { RbacGuard } from "../dist/common/rbac.guard.js";
import { IS_PUBLIC_KEY } from "../dist/common/public.decorator.js";
import { REQUIRED_PERMISSIONS_KEY } from "../dist/common/permissions.decorator.js";

// AUDIT_REMEDIATION_PLAN 0.47.
// (a) plans/delegations/context/mission-control had no RBAC metadata, so the
//     global deny-by-default RbacGuard rejected every caller with 403
//     "RBAC metadata required" — the streams were dead for all roles.
// (b) agentsStream was @Public(): anonymous callers saw every tenant's agent bus.
// (c) Re-enabling (a) with only a tenant check would reopen 0.37 (other orgs of
//     the same tenant), so the streams reuse ProjectAccessService like REST.

type Actor = { tenantId: string; orgId: string; userId: string; roles: string[] };
const actor = (roles: string[], orgId = "org_client", userId = "usr_client", tenantId = "tnt"): Actor =>
  ({ tenantId, orgId, userId, roles });

const ALL_STREAMS = [
  "planStream", "delegationsStream", "contextStream", "missionControlStream",
  "financeStream", "buildopsStream", "agentsStream", "healthStream",
] as const;

function guardAllows(handler: string, who: Actor | null): boolean {
  const guard = new RbacGuard(new Reflector());
  try {
    return guard.canActivate({
      getHandler: () => (SseController.prototype as never as Record<string, unknown>)[handler],
      getClass: () => SseController,
      switchToHttp: () => ({ getRequest: () => ({ headers: {}, authContext: who ?? undefined }) }),
    } as never);
  } catch (error) {
    if (error instanceof ForbiddenException) return false;
    throw error;
  }
}

test("every SSE handler declares RBAC metadata — none falls into deny_by_default", () => {
  for (const name of ALL_STREAMS) {
    const handler = (SseController.prototype as never as Record<string, unknown>)[name] as object;
    const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, handler) === true;
    const perms = Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, handler) as string[] | undefined;
    assert.ok(isPublic || (perms?.length ?? 0) > 0, `${name} has neither @Public() nor @RequirePermissions()`);
  }
});

test("each stream requires the same permission as its REST twin", () => {
  const expected: Record<string, string> = {
    planStream: "agents:run:create",
    delegationsStream: "ops:coordinator:read",
    contextStream: "agents:run:create",
    missionControlStream: "ops:dashboard:read",
    agentsStream: "ops:dashboard:read",
  };
  for (const [name, permission] of Object.entries(expected)) {
    const handler = (SseController.prototype as never as Record<string, unknown>)[name] as object;
    assert.deepEqual(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, handler), [permission], name);
  }
});

test("only healthStream stays @Public(); agentsStream no longer is", () => {
  assert.equal(Reflect.getMetadata(IS_PUBLIC_KEY, SseController.prototype.healthStream), true);
  assert.notEqual(Reflect.getMetadata(IS_PUBLIC_KEY, SseController.prototype.agentsStream), true);
});

test("RbacGuard: OPS_ADMIN reaches every stream (previously 4 were 403 for everyone)", () => {
  for (const name of ALL_STREAMS) assert.equal(guardAllows(name, actor(["OPS_ADMIN"])), true, name);
});

test("RbacGuard: CLIENT/PRO/WORKER reach plans+context, not admin feeds", () => {
  for (const roles of [["CLIENT"], ["PRO"], ["WORKER"]]) {
    assert.equal(guardAllows("planStream", actor(roles)), true, `${roles} planStream`);
    assert.equal(guardAllows("contextStream", actor(roles)), true, `${roles} contextStream`);
    for (const adminOnly of ["agentsStream", "missionControlStream", "delegationsStream"]) {
      assert.equal(guardAllows(adminOnly, actor(roles)), false, `${roles} ${adminOnly}`);
    }
  }
});

// ── Behaviour with the real bus ────────────────────────────────────────────

function fixture() {
  const bus = new SseEventBusService();
  // project_a: client org "org_client" + pro org "org_pro". project_b: another org.
  const members: Record<string, string[]> = { project_a: ["org_client", "org_pro"], project_b: ["org_other"] };
  const projectAccess = {
    async assertProjectAccess(who: Actor, projectId: string) {
      if (!members[projectId]) throw new NotFoundException("Project not found");
      if (who.roles.includes("OPS_ADMIN")) return;
      if (!members[projectId].includes(who.orgId)) throw new ForbiddenException("no access");
    },
    async assertPlanAccess(who: Actor, plan: { projectId?: string; createdBy: string }) {
      if (plan.projectId) return this.assertProjectAccess(who, plan.projectId);
      if (who.roles.includes("OPS_ADMIN") || who.userId === plan.createdBy) return;
      throw new ForbiddenException("no access");
    },
  };
  const plansById: Record<string, { id: string; projectId?: string; createdBy: string }> = {
    plan_a: { id: "plan_a", projectId: "project_a", createdBy: "usr_client" },
    plan_b: { id: "plan_b", projectId: "project_b", createdBy: "usr_other" },
    plan_private: { id: "plan_private", createdBy: "usr_client" },
  };
  const plans = {
    async findById(_tenantId: string, planId: string) {
      const plan = plansById[planId];
      if (!plan) throw new NotFoundException("Work plan not found");
      return plan;
    },
  };
  const delegations = { async listByProject() { return [{ id: "d1" }]; } };
  const controller = new SseController(
    bus, {} as never, plans as never, delegations as never, {} as never, projectAccess as never,
  );

  function collect(t: { after(fn: () => void): void }, stream: { subscribe(fn: (m: { type?: string; data: unknown }) => void): { unsubscribe(): void } }) {
    const received: Array<{ type?: string; data: any }> = [];
    const sub = stream.subscribe((m) => {
      if (m.type === "keepalive") return;
      received.push({ type: m.type, data: JSON.parse(String(m.data)) });
    });
    t.after(() => sub.unsubscribe());
    return received;
  }
  return { bus, controller, collect };
}

test("planStream: participant gets snapshot + live pushes", async (t) => {
  const f = fixture();
  const got = f.collect(t, f.controller.planStream("plan_a", { authContext: actor(["PRO"], "org_pro", "usr_pro") }));
  await tick(); await tick();
  f.bus.emit("plan:plan_a", "plan-update", { step: 2 });
  await tick();
  assert.deepEqual(got.map((e) => e.type), ["plan-update", "plan-update"]);
});

test("planStream: same tenant, other org → no snapshot, no push (0.37 not reopened)", async (t) => {
  const f = fixture();
  const got = f.collect(t, f.controller.planStream("plan_b", { authContext: actor(["CLIENT"]) }));
  await tick(); await tick();
  f.bus.emit("plan:plan_b", "plan-update", { secret: true });
  await tick();
  assert.equal(got.length, 0);
});

test("planStream: project-less plan only for its creator", async (t) => {
  const f = fixture();
  const creator = f.collect(t, f.controller.planStream("plan_private", { authContext: actor(["CLIENT"]) }));
  const other = f.collect(t, f.controller.planStream("plan_private", { authContext: actor(["CLIENT"], "org_client", "usr_someone_else") }));
  await tick(); await tick();
  assert.equal(creator.length, 1);
  assert.equal(other.length, 0);
});

test("delegationsStream: denied project → keepalive only; allowed project → initial + push", async (t) => {
  const f = fixture();
  const admin = actor(["OPS_ADMIN"], "org_ops", "usr_ops");
  const allowed = f.collect(t, f.controller.delegationsStream("project_a", { authContext: admin }));
  const missing = f.collect(t, f.controller.delegationsStream("project_missing", { authContext: admin }));
  await tick(); await tick();
  f.bus.emit("delegations:project_a", "delegation-update", { id: "d2" });
  f.bus.emit("delegations:project_missing", "delegation-update", { id: "leak" });
  await tick();
  assert.deepEqual(allowed.map((e) => e.type), ["delegations-update", "delegation-update"]);
  assert.equal(missing.length, 0);
});

test("contextStream without projectId: non-admin never sees other projects or other users", async (t) => {
  const f = fixture();
  const got = f.collect(t, f.controller.contextStream(undefined, { authContext: actor(["CLIENT"]) }));
  await tick();
  f.bus.emit("context:tnt:tenant", "context-update", { projectId: null, userId: null, scope: "tenant" });
  f.bus.emit("context:tnt:tenant", "context-update", { projectId: "project_b", userId: null, scope: "project" });
  f.bus.emit("context:tnt:tenant", "context-update", { projectId: null, userId: "usr_other", scope: "user" });
  f.bus.emit("context:tnt:tenant", "context-update", { projectId: null, userId: "usr_client", scope: "user" });
  f.bus.emit("context:other_tenant:tenant", "context-update", { projectId: null, userId: null, scope: "tenant" });
  await tick();
  assert.deepEqual(got.map((e) => e.data.scope), ["tenant", "user"]);
  assert.equal(got[1].data.userId, "usr_client");
});

test("contextStream with projectId: participant gets that project only; non-participant gets nothing", async (t) => {
  const f = fixture();
  const member = f.collect(t, f.controller.contextStream("project_a", { authContext: actor(["PRO"], "org_pro", "usr_pro") }));
  const outsider = f.collect(t, f.controller.contextStream("project_a", { authContext: actor(["CLIENT"], "org_other", "usr_x") }));
  await tick(); await tick();
  f.bus.emit("context:tnt:project:project_a", "context-update", { projectId: "project_a", userId: null });
  f.bus.emit("context:tnt:project:project_b", "context-update", { projectId: "project_b", userId: null });
  await tick();
  assert.deepEqual(member.map((e) => e.data.projectId), ["project_a"]);
  assert.equal(outsider.length, 0);
});

test("contextStream: OPS_ADMIN without projectId keeps the tenant-wide view", async (t) => {
  const f = fixture();
  const got = f.collect(t, f.controller.contextStream(undefined, { authContext: actor(["OPS_ADMIN"], "org_ops", "usr_ops") }));
  await tick();
  f.bus.emit("context:tnt:tenant", "context-update", { projectId: "project_b", userId: "usr_other" });
  await tick();
  assert.equal(got.length, 1);
});
