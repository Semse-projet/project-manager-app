import type { NextRequest } from "next/server";
import { proxyAuthenticated, readJsonBody, segment } from "../../../_authenticated-proxy";

// Spec: docs/specs/core/crews-worksites.spec.md (APPROVED 2026-11-12). Behind
// SEMSE_CREWS_ENABLED: with the flag off the API answers 404 and the UI says so.
type Ctx = { params: Promise<{ orgId: string }> };

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: Ctx) {
  const { orgId } = await context.params;
  return proxyAuthenticated(request, `/v1/organizations/${segment(orgId)}/crews`);
}

export async function POST(request: NextRequest, context: Ctx) {
  const { orgId } = await context.params;
  const body = await readJsonBody(request);
  return proxyAuthenticated(request, `/v1/organizations/${segment(orgId)}/crews`, {
    method: "POST",
    body: {
      name: body.name,
      supervisorUserId: body.supervisorUserId,
      ...(body.worksiteId ? { worksiteId: body.worksiteId } : {})
    },
    status: 201
  });
}
