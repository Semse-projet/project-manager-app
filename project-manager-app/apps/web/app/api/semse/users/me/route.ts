import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, resolveRuntimeConfigForRequest, runtimeDisabledResponse } from "../../_server";

export async function GET(request: NextRequest) {
  try {
    const runtimeConfig = await resolveRuntimeConfigForRequest(request);
    if (!runtimeConfig) {
      return runtimeDisabledResponse();
    }

    const data = await fetchSemseDataForRequest<Record<string, unknown>>(
      "/v1/users/me",
      request,
    );
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) {
      return runtimeDisabledResponse();
    }

    return handleServerError(error);
  }
}
