import type { NextRequest } from "next/server";
import { proxyAuthenticated, segment } from "../../../_authenticated-proxy";

type Ctx = { params: Promise<{ runId: string }> };

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: Ctx) {
  const { runId } = await context.params;
  return proxyAuthenticated(request, `/v1/forge/runs/${segment(runId)}`);
}
