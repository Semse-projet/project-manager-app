import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../../_server";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
  if (!isApiBaseConfigured()) {
    return runtimeDisabledResponse();
  }

  try {
    const { id } = await context.params;
    const data = await fetchSemseDataForRequest(
      `/v1/ops/agent-runtime/${encodeURIComponent(id)}`,
      req
    );

    return NextResponse.json({
      requestId: "web-ops-agent-runtime-trace",
      data
    });
  } catch (error) {
    return handleServerError(error);
  }
}
