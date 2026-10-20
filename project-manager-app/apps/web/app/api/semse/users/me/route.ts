import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForAuthenticatedRequest, handleServerError, getAuthenticatedServerConfig, runtimeDisabledResponse } from "../../_server";

export async function GET(request: NextRequest) {
  try {
    const runtimeConfig = await getAuthenticatedServerConfig(request);
    if (!runtimeConfig) {
      return runtimeDisabledResponse();
    }

    const data = await fetchSemseDataForAuthenticatedRequest<Record<string, unknown>>(
      "/v1/users/me",
      request,
    );
    return NextResponse.json({ data, context: { orgId: runtimeConfig.orgId } }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) {
      return runtimeDisabledResponse();
    }

    return handleServerError(error);
  }
}

