import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../_server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isApiBaseConfigured()) {
    return runtimeDisabledResponse();
  }

  try {
    const search = req.nextUrl.searchParams.toString();
    const path = search.length > 0 ? `/v1/ops/agent-runtime?${search}` : "/v1/ops/agent-runtime";
    const data = await fetchSemseDataForRequest(path, req);

    return NextResponse.json({
      requestId: "web-ops-agent-runtime",
      data
    });
  } catch (error) {
    return handleServerError(error);
  }
}
