import type { NextRequest } from "next/server";
import { proxyAuthenticated, readJsonBody, segment } from "../../../../../../_authenticated-proxy";

type Ctx = { params: Promise<{ runId: string; mode: string }> };

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: Ctx) {
  const { runId, mode } = await context.params;
  const body = await readJsonBody(request);
  return proxyAuthenticated(
    request,
    `/v1/forge/runs/${segment(runId)}/approvals/${segment(mode)}/decide`,
    { method: "POST", body: { decision: body.decision } }
  );
}
