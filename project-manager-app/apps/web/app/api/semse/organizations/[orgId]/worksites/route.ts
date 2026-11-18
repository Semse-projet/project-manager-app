import type { NextRequest } from "next/server";
import { proxyAuthenticated, readJsonBody, segment } from "../../../_authenticated-proxy";

type Ctx = { params: Promise<{ orgId: string }> };

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: Ctx) {
  const { orgId } = await context.params;
  return proxyAuthenticated(request, `/v1/organizations/${segment(orgId)}/worksites`);
}

export async function POST(request: NextRequest, context: Ctx) {
  const { orgId } = await context.params;
  const body = await readJsonBody(request);
  return proxyAuthenticated(request, `/v1/organizations/${segment(orgId)}/worksites`, {
    method: "POST",
    body: { name: body.name, ...(body.address ? { address: body.address } : {}) },
    status: 201
  });
}
