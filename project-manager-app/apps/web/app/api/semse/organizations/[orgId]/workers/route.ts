import type { NextRequest } from "next/server";
import { proxyAuthenticated, segment } from "../../../_authenticated-proxy";

// Spec: docs/specs/core/crews-worksites.spec.md AC-11 — ACTIVE WORKERs of the
// org (userId, since), the only people who can supervise or join a crew.
type Ctx = { params: Promise<{ orgId: string }> };

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: Ctx) {
  const { orgId } = await context.params;
  return proxyAuthenticated(request, `/v1/organizations/${segment(orgId)}/workers`);
}
