import type { NextRequest } from "next/server";
import { proxyAuthenticated, readJsonBody, segment } from "../../../_authenticated-proxy";

type Ctx = { params: Promise<{ projectId: string }> };

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: Ctx) {
  const { projectId } = await context.params;
  return proxyAuthenticated(request, `/v1/projects/${segment(projectId)}/liens/calendar`);
}

export async function POST(request: NextRequest, context: Ctx) {
  const { projectId } = await context.params;
  const body = await readJsonBody(request);
  return proxyAuthenticated(request, `/v1/projects/${segment(projectId)}/liens/calendar`, {
    method: "POST",
    body: { stateName: body.stateName, projectStartDate: body.projectStartDate },
    status: 201
  });
}
