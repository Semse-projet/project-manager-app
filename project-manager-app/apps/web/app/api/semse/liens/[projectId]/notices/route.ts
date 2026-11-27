import type { NextRequest } from "next/server";
import { proxyAuthenticated, segment } from "../../../_authenticated-proxy";

type Ctx = { params: Promise<{ projectId: string }> };

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: Ctx) {
  const { projectId } = await context.params;
  return proxyAuthenticated(request, `/v1/projects/${segment(projectId)}/liens/notices`);
}
