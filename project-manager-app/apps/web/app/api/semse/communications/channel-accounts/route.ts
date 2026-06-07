import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../_server";
import { requireCommunicationsSession } from "../_auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isApiBaseConfigured()) {
    return runtimeDisabledResponse();
  }

  try {
    const authError = await requireCommunicationsSession(request);
    if (authError) return authError;

    const data = await fetchSemseDataForRequest("/v1/communications/channel-accounts", request);

    return NextResponse.json({
      requestId: "web-communications-channel-accounts",
      data,
    });
  } catch (error) {
    return handleServerError(error);
  }
}
