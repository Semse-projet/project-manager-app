import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../../_server";

async function handleReadAll(request: NextRequest) {
  try {
    const data = await fetchSemseDataForRequest<Record<string, unknown>>(
      "/v1/notifications/read-all",
      request,
      { method: "PATCH", headers: { "content-type": "application/json" }, body: "{}" }
    );
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) {
      return runtimeDisabledResponse();
    }
    return handleServerError(error);
  }
}

export const PATCH = handleReadAll;
export const POST = handleReadAll;
