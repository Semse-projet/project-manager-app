import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../_server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isApiBaseConfigured()) {
    return runtimeDisabledResponse();
  }

  try {
    const { searchParams } = new URL(request.url);
    const qs = searchParams.toString();
    const data = await fetchSemseDataForRequest(
      `/v1/communications/threads${qs ? `?${qs}` : ""}`,
      request,
    );

    return NextResponse.json({
      requestId: "web-communications-threads",
      data,
    });
  } catch (error) {
    return handleServerError(error);
  }
}
