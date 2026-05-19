import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../_server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isApiBaseConfigured()) {
    return runtimeDisabledResponse();
  }

  try {
    const body = await request.json();
    const data = await fetchSemseDataForRequest("/v1/communications/inbound", request, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    return NextResponse.json({
      requestId: "web-communications-inbound",
      data,
    });
  } catch (error) {
    return handleServerError(error);
  }
}
