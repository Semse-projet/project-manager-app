import { describe, it, expect, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { PLANS } from "./stripe";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-001",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    stripeCustomerId: null,
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: { origin: "http://localhost:3000" } } as unknown as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
  return { ctx };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("billing.plans", () => {
  it("returns all available plans as a public endpoint", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    const plans = await caller.billing.plans();

    expect(plans).toBeDefined();
    expect(plans).toHaveLength(3);

    const keys = plans.map((p) => p.key);
    expect(keys).toContain("free");
    expect(keys).toContain("pro");
    expect(keys).toContain("team");
  });

  it("returns correct price for each plan", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    const plans = await caller.billing.plans();

    const freePlan = plans.find((p) => p.key === "free");
    const proPlan = plans.find((p) => p.key === "pro");
    const teamPlan = plans.find((p) => p.key === "team");

    expect(freePlan?.price).toBe(0);
    expect(proPlan?.price).toBe(1900);
    expect(teamPlan?.price).toBe(4900);
  });

  it("each plan has features array", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    const plans = await caller.billing.plans();

    for (const plan of plans) {
      expect(Array.isArray(plan.features)).toBe(true);
      expect(plan.features.length).toBeGreaterThan(0);
    }
  });
});

describe("billing.subscription", () => {
  it("returns null when no active subscription", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const sub = await caller.billing.subscription();
    expect(sub).toBeNull();
  });

  it("requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.billing.subscription()).rejects.toThrow();
  });
});

describe("billing.createCheckout", () => {
  it("requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.billing.createCheckout({ planKey: "pro" })
    ).rejects.toThrow();
  });

  it("rejects invalid plan keys", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      // @ts-expect-error - testing invalid input
      caller.billing.createCheckout({ planKey: "invalid" })
    ).rejects.toThrow();
  });
});

describe("billing.createPortalSession", () => {
  it("requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.billing.createPortalSession()).rejects.toThrow();
  });

  it("throws error when user has no stripeCustomerId", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.billing.createPortalSession()).rejects.toThrow(
      "No Stripe customer found"
    );
  });
});

describe("billing.payments", () => {
  it("returns empty array when no stripeCustomerId", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const payments = await caller.billing.payments();
    expect(payments).toEqual([]);
  });

  it("requires authentication", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.billing.payments()).rejects.toThrow();
  });
});

describe("PLANS configuration", () => {
  it("has correct structure for all plans", () => {
    expect(PLANS.free).toBeDefined();
    expect(PLANS.pro).toBeDefined();
    expect(PLANS.team).toBeDefined();
  });

  it("free plan has no interval", () => {
    expect(PLANS.free.interval).toBeNull();
  });

  it("paid plans have monthly interval", () => {
    expect(PLANS.pro.interval).toBe("month");
    expect(PLANS.team.interval).toBe("month");
  });

  it("prices are in cents", () => {
    expect(PLANS.free.price).toBe(0);
    expect(PLANS.pro.price).toBeGreaterThan(100); // At least $1
    expect(PLANS.team.price).toBeGreaterThan(PLANS.pro.price);
  });
});
