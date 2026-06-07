import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../_server";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    correlationId: string;
  }>;
};

export async function GET(req: NextRequest, context: RouteContext) {
  if (!isApiBaseConfigured()) {
    return runtimeDisabledResponse();
  }

  try {
    const { correlationId } = await context.params;
    const data = await fetchSemseDataForRequest(
      `/v1/domain-events/${encodeURIComponent(correlationId)}`,
      req
    );

    return NextResponse.json({
      requestId: "web-domain-events-trace",
      data
    });
  } catch (error) {
    return handleServerError(error);
  }
}
