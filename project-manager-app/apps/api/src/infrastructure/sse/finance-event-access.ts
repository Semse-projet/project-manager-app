import { FinanceAccessPolicy } from "../../modules/finance/finance-access.policy.js";
import { ResourceScopeResolver } from "../../common/resource-scope.resolver.js";
import type { ScopeActor } from "../../common/resource-scope.js";
import type { PrismaService } from "../prisma/prisma.service.js";

/** A tenant-wide subscription does not authorize the financial resource in its payload. */
export async function canReadFinanceEvent(actor: ScopeActor, data: unknown, prisma: PrismaService): Promise<boolean> {
  if (!data || typeof data !== "object" || !("invoiceId" in data) || typeof data.invoiceId !== "string") return false;
  try {
    const row = await prisma.invoice.findFirst({
      where: { id: data.invoiceId, tenantId: actor.tenantId },
      select: { tenantId: true, orgId: true, projectId: true, jobId: true },
    });
    await new FinanceAccessPolicy(new ResourceScopeResolver(prisma)).assertRowAccess(actor, row, "Invoice not found");
    return true;
  } catch { return false; }
}
