/**
 * DEC-R1: create synthetic memberships exclusively in a disposable local CI DB.
 * Existing smoke tests used to mint bearer tokens for arbitrary user/org IDs;
 * the new production auth gate correctly denies those identities. Seed real
 * membership records instead of bypassing permission checks.
 *
 * Not a production seed or a user onboarding entrypoint.
 */
export async function ensureDecR1CiSmokeIdentity(input) {
  if (process.env.CI !== "true") return;

  if (
    process.env.NODE_ENV === "production" ||
    process.env.RAILWAY_ENVIRONMENT ||
    process.env.RAILWAY_ENVIRONMENT_ID
  ) {
    throw new Error("DEC-R1 synthetic identity seeding is forbidden outside isolated CI");
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("CI smoke DATABASE_URL is required");
  const url = new URL(databaseUrl);
  if (
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.port !== "5433" ||
    !url.pathname.endsWith("/semse")
  ) {
    throw new Error("DEC-R1 fixture requires a disposable local CI Postgres on port 5433");
  }

  const roles = [...new Set(input.roles)].filter(Boolean);
  if (!roles.length || roles.some((role) => !["OPS_ADMIN", "EVENT_CONSUMER", "WORKER"].includes(role))) {
    throw new Error("Unexpected smoke role; fixture grants only explicitly allowed service roles");
  }

  // The generated Prisma client is produced by pnpm db:generate before smokes.
  const module = await import("../node_modules/.prisma/client/index.js");
  const { PrismaClient } = module.default ?? module;
  const prisma = new PrismaClient();

  try {
    await prisma.$transaction(async (tx) => {
      await tx.tenant.upsert({
        where: { id: input.tenantId },
        update: {},
        create: {
          id: input.tenantId, slug: input.tenantId,
          name: "DEC-R1 isolated test tenant", status: "active"
        }
      });
      await tx.org.upsert({
        where: { id: input.orgId },
        update: {},
        create: {
          id: input.orgId, tenantId: input.tenantId,
          type: "ops", name: "DEC-R1 isolated test org"
        }
      });
      await tx.user.upsert({
        where: { id: input.userId },
        update: { status: "active" },
        create: {
          id: input.userId,
          email: `dec-r1-${input.userId.toLowerCase()}@example.invalid`,
          status: "active"
        }
      });
      for (const roleKey of roles) {
        const role = await tx.role.upsert({
          where: { key: roleKey },
          update: {},
          create: { key: roleKey, name: roleKey }
        });
        await tx.membership.upsert({
          where: {
            userId_orgId_roleId: {
              userId: input.userId, orgId: input.orgId, roleId: role.id
            }
          },
          update: { status: "ACTIVE" },
          create: {
            userId: input.userId, orgId: input.orgId,
            roleId: role.id, status: "ACTIVE"
          }
        });
      }
    });
  } finally {
    await prisma.$disconnect();
  }
}
