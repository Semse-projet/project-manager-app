import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../_server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isApiBaseConfigured()) {
    return runtimeDisabledResponse();
  }

  try {
    const data = await fetchSemseDataForRequest("/v1/autonomy/provider", req);
    return NextResponse.json({ requestId: "web-autonomy-provider", data });
  } catch (error) {
    return handleServerError(error);
  }
}
