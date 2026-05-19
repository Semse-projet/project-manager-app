import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../_server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isApiBaseConfigured()) {
    return runtimeDisabledResponse();
  }

  try {
    const data = await fetchSemseDataForRequest("/v1/communications/channel-accounts", request);

    return NextResponse.json({
      requestId: "web-communications-channel-accounts",
      data,
    });
  } catch (error) {
    return handleServerError(error);
  }
}
