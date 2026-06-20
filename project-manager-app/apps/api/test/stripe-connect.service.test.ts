import test from "node:test";
import assert from "node:assert/strict";
import { StripeConnectService } from "../dist/modules/payments/stripe-connect.service.js";

function createPrismaStub() {
  const rows = new Map<string, Record<string, unknown>>();
  const prisma = {
    stripeConnectAccount: {
      async findUnique({ where }: { where: { userId: string }; select?: Record<string, unknown> }) {
        return rows.get(where.userId) ?? null;
      },
      async create({ data }: { data: Record<string, unknown> }) {
        const row = {
          userId: String(data.userId),
          stripeAccountId: String(data.stripeAccountId),
          status: String(data.status ?? "pending"),
          chargesEnabled: false,
          payoutsEnabled: false,
          onboardingUrl: null,
          country: "US",
          currency: "USD",
          updatedAt: new Date("2026-06-09T12:00:00.000Z"),
        };
        rows.set(String(data.userId), row);
        return row;
      },
      async update({ where, data }: { where: { userId: string }; data: Record<string, unknown> }) {
        const current = rows.get(where.userId);
        if (!current) throw new Error("missing row");
        const next = { ...current, ...data, updatedAt: new Date("2026-06-09T12:05:00.000Z") };
        rows.set(where.userId, next);
        return next;
      },
    },
  };
  return { prisma, rows };
}

test("StripeConnectService uses mock onboarding and transfer fallback when Stripe key is absent", async () => {
  const previousKey = process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_SECRET_KEY;

  try {
    const { prisma } = createPrismaStub();
    const service = new StripeConnectService(prisma as never);

    const account = await service.getOrCreateAccount("usr_1", "worker@example.com");
    const onboarding = await service.createOnboardingLink("usr_1", "https://app.example.com/return", "https://app.example.com/refresh");
    const transfer = await service.transferToContractor({
      userId: "usr_1",
      amountUsd: 1000,
      currency: "USD",
      metadata: { projectId: "proj_1" },
    });

    assert.equal(account.stripeAccountId, "acct_mock_usr1");
    assert.equal(account.status, "pending");
    assert.ok(onboarding.onboardingUrl.includes("mock=true"));
    assert.equal(transfer.platformFeeCents, 750);
    assert.equal(transfer.netAmountUsd, 992.5);
    assert.ok(transfer.transferId.startsWith("tr_mock_"));
  } finally {
    if (previousKey === undefined) {
      delete process.env.STRIPE_SECRET_KEY;
    } else {
      process.env.STRIPE_SECRET_KEY = previousKey;
    }
  }
});

test("StripeConnectService upgrades persisted mock account before creating live onboarding link", async () => {
  const previousKey = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = "sk_test_semse";

  try {
    const { prisma, rows } = createPrismaStub();
    rows.set("usr_1", {
      userId: "usr_1",
      stripeAccountId: "acct_mock_usr1",
      status: "pending",
      chargesEnabled: false,
      payoutsEnabled: false,
      onboardingUrl: null,
      country: "US",
      currency: "usd",
      updatedAt: new Date("2026-06-20T12:00:00.000Z"),
    });
    const service = new StripeConnectService(prisma as never);
    let onboardingAccount = "";
    (service as unknown as { stripe: unknown }).stripe = {
      accounts: {
        async create() {
          return { id: "acct_live_usr1" };
        },
      },
      accountLinks: {
        async create(input: { account: string }) {
          onboardingAccount = input.account;
          return { url: "https://connect.stripe.test/onboard" };
        },
      },
    };

    const link = await service.createOnboardingLink(
      "usr_1",
      "https://app.example.com/return",
      "https://app.example.com/refresh",
    );

    assert.equal(onboardingAccount, "acct_live_usr1");
    assert.equal(link.stripeAccountId, "acct_live_usr1");
    assert.equal(link.onboardingUrl, "https://connect.stripe.test/onboard");
    assert.equal(rows.get("usr_1")?.stripeAccountId, "acct_live_usr1");
    assert.equal(rows.get("usr_1")?.onboardingUrl, "https://connect.stripe.test/onboard");
  } finally {
    if (previousKey === undefined) {
      delete process.env.STRIPE_SECRET_KEY;
    } else {
      process.env.STRIPE_SECRET_KEY = previousKey;
    }
  }
});

test("StripeConnectService returns safe Stripe diagnostics when account creation fails", async () => {
  const previousKey = process.env.STRIPE_SECRET_KEY;
  process.env.STRIPE_SECRET_KEY = "sk_test_semse";

  try {
    const { prisma } = createPrismaStub();
    const service = new StripeConnectService(prisma as never);
    (service as unknown as { stripe: unknown }).stripe = {
      accounts: {
        async create() {
          const error = new Error("Your account is not enabled for Connect onboarding.");
          (error as Error & { code?: string; type?: string }).code = "account_invalid";
          (error as Error & { code?: string; type?: string }).type = "StripeInvalidRequestError";
          throw error;
        },
      },
    };

    await assert.rejects(
      () => service.getOrCreateAccount("usr_2", "worker@example.com"),
      /Stripe respondió: code=account_invalid; type=StripeInvalidRequestError; message=Your account is not enabled/,
    );
  } finally {
    if (previousKey === undefined) {
      delete process.env.STRIPE_SECRET_KEY;
    } else {
      process.env.STRIPE_SECRET_KEY = previousKey;
    }
  }
});
