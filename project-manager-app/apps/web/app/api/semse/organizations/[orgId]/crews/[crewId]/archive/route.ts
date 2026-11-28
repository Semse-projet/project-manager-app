import type { NextRequest } from "next/server";
import { proxyAuthenticated, segment } from "../../../../../_authenticated-proxy";

type Ctx = { params: Promise<{ orgId: string; crewId: string }> };

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: Ctx) {
  const { orgId, crewId } = await context.params;
  return proxyAuthenticated(request, `/v1/organizations/${segment(orgId)}/crews/${segment(crewId)}/archive`, {
    method: "POST"
  });
}
