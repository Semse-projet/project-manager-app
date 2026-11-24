import type { NextRequest } from "next/server";
import { proxyAuthenticated, readJsonBody, segment } from "../../../../../_authenticated-proxy";

type Ctx = { params: Promise<{ projectId: string; waiverId: string }> };

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: Ctx) {
  const { projectId, waiverId } = await context.params;
  const body = await readJsonBody(request);
  return proxyAuthenticated(
    request,
    `/v1/projects/${segment(projectId)}/liens/waivers/${segment(waiverId)}/sign`,
    { method: "POST", body: { signature: body.signature } }
  );
}
