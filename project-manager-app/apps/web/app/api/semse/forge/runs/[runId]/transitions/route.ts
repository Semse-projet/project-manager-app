import type { NextRequest } from "next/server";
import { proxyAuthenticated, readJsonBody, segment } from "../../../../_authenticated-proxy";

type Ctx = { params: Promise<{ runId: string }> };

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, context: Ctx) {
  const { runId } = await context.params;
  const body = await readJsonBody(request);
  return proxyAuthenticated(request, `/v1/forge/runs/${segment(runId)}/transitions`, {
    method: "POST",
    body: { next: body.next }
  });
}
