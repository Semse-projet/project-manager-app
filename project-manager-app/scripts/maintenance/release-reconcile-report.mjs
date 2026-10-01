#!/usr/bin/env node
/**
 * ADR-041 2b — Informe (SOLO LECTURA) de RELEASE PENDING estancados.
 *
 *   node scripts/maintenance/release-reconcile-report.mjs [--stale-minutes=30] [--report=out.json]
 *
 * Requiere `pnpm --filter @semse/api build` (usa dist). No escribe en la DB,
 * no llama al proveedor. Exit 0 sin estancados; exit 3 si hay (para alertar).
 */
import prismaClientPkg from "@prisma/client";
import { writeFileSync } from "fs";
import { buildReconciliationReport } from "../../apps/api/dist/modules/payments/escrow-release.reconcile.js";

const { PrismaClient } = prismaClientPkg;
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => a.replace(/^--/, "").split("=")),
);
const staleMinutes = Number(args["stale-minutes"] ?? 30);
if (!Number.isFinite(staleMinutes) || staleMinutes < 1) {
  console.error("[reconcile] --stale-minutes debe ser >= 1");
  process.exit(2);
}

const prisma = new PrismaClient();
try {
  const now = new Date();
  const rows = await prisma.paymentTxn.findMany({
    where: { type: "RELEASE", status: "PENDING", createdAt: { lt: new Date(now.getTime() - staleMinutes * 60_000) } },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
  const report = buildReconciliationReport(
    rows.map((r) => ({
      id: r.id,
      milestoneId: r.milestoneId,
      providerRef: r.providerRef,
      amount: r.amount.toNumber(),
      createdAt: r.createdAt,
    })),
    now,
    staleMinutes * 60_000,
  );
  const text = JSON.stringify(report, null, 2);
  if (args.report) writeFileSync(args.report, text);
  console.log(text);
  await prisma.$disconnect().catch(() => {});
  process.exit(report.total > 0 ? 3 : 0);
} catch (err) {
  console.error("[reconcile] error:", err instanceof Error ? err.message : err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
}
