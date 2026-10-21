import "reflect-metadata";

import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { NEVER } from "rxjs";
import { SseController } from "../dist/infrastructure/sse/sse.controller.js";
import { RbacGuard } from "../dist/common/rbac.guard.js";
import { REQUIRED_PERMISSIONS_KEY } from "../src/common/permissions.decorator.ts";

// KIT-F3-01 (docs/semse-kit/test-matrix.md): these four streams shipped with no
// RBAC metadata, so the deny-by-default RbacGuard answered 403 "RBAC metadata
// required" to every role and their screens never received live updates.

const handlers = SseController.prototype as unknown as Record<string, Function>;

function context(handler: Function, roles: string[]) {
  return {
    getHandler: () => handler,
    getClass: () => SseController,
    switchToHttp: () => ({
      getRequest: () => ({ authContext: { tenantId: "tenant_1", orgId: "org_1", userId: "usr_1", roles } }),
    }),
  } as never;
}

test("each previously broken stream declares the permission of its REST counterpart", () => {
  const expected: Record<string, string[]> = {
    missionControlStream: ["ops:dashboard:read"],
    delegationsStream: ["ops:coordinator:read"],
    contextStream: ["ops:dashboard:read"],
    planStream: ["agents:run:create"],
  };
  for (const [name, permissions] of Object.entries(expected)) {
    assert.deepEqual(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, handlers[name]), permissions, name);
  }
});

test("OPS streams open for OPS_ADMIN and stay closed for client and professional roles", () => {
  const guard = new RbacGuard(new Reflector());
  for (const name of ["missionControlStream", "delegationsStream", "contextStream"]) {
    assert.equal(guard.canActivate(context(handlers[name], ["OPS_ADMIN"])), true, `${name} for OPS_ADMIN`);
    for (const role of ["CLIENT", "PRO", "WORKER"]) {
      assert.throws(
        () => guard.canActivate(context(handlers[name], [role])),
        (error) => error instanceof ForbiddenException && String(error.message).includes("Insufficient permissions"),
        `${name} must stay closed for ${role}`,
      );
    }
  }
  assert.equal(guard.canActivate(context(handlers.planStream, ["CLIENT"])), true, "plan owners are clients");
});

function planStreamHarness(accessAllowed: boolean) {
  const subscribedChannels: string[] = [];
  const bus = {
    on: (channel: string) => {
      subscribedChannels.push(channel);
      return NEVER;
    },
  } as never;
  const plan = { id: "plan_1", tenantId: "tenant_1", projectId: "project_org_a", createdBy: "usr_owner", status: "pending_approval" };
  const plans = { findById: async () => plan } as never;
  const accessChecks: unknown[] = [];
  const projectAccess = {
    assertPlanAccess: async (actor: unknown, ownership: unknown) => {
      accessChecks.push({ actor, ownership });
      if (!accessAllowed) throw new ForbiddenException("Actor cannot access this plan");
    },
  } as never;
  const controller = new SseController(bus, {} as never, plans, {} as never, {} as never, projectAccess);
  return { controller, subscribedChannels, accessChecks };
}

async function firstEvents(stream: { subscribe: Function }, waitMs = 30): Promise<Array<{ type?: string; data?: string }>> {
  const events: Array<{ type?: string; data?: string }> = [];
  const subscription = stream.subscribe((event: { type?: string; data?: string }) => events.push(event));
  await new Promise((resolve) => setTimeout(resolve, waitMs));
  subscription.unsubscribe();
  return events;
}

const intruderRequest = { authContext: { tenantId: "tenant_1", orgId: "org_b", userId: "usr_intruder", roles: ["CLIENT"] } };
const ownerRequest = { authContext: { tenantId: "tenant_1", orgId: "org_a", userId: "usr_owner", roles: ["CLIENT"] } };

test("planStream: a client of another organization gets neither the plan nor its live channel", async () => {
  const { controller, subscribedChannels, accessChecks } = planStreamHarness(false);
  const events = await firstEvents(controller.planStream("plan_1", intruderRequest as never));

  assert.equal(accessChecks.length, 1, "the REST plan-access check must run before anything is sent");
  assert.deepEqual((accessChecks[0] as { ownership: unknown }).ownership, { projectId: "project_org_a", createdBy: "usr_owner" });
  assert.deepEqual(events, [], "no plan-update for an actor without access");
  assert.deepEqual(subscribedChannels, [], "no subscription to plan:plan_1 for an actor without access");
});

test("planStream: the owner gets the plan and the live channel", async () => {
  const { controller, subscribedChannels } = planStreamHarness(true);
  const events = await firstEvents(controller.planStream("plan_1", ownerRequest as never));

  assert.equal(events[0]?.type, "plan-update");
  assert.equal(JSON.parse(events[0]!.data!).id, "plan_1");
  assert.deepEqual(subscribedChannels, ["plan:plan_1"]);
});
