import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../../../_server";

export async function GET(request: NextRequest) {
  try {
    const data = await fetchSemseDataForRequest("/v1/intelligence/pmo/dashboard", request);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) return runtimeDisabledResponse();
    return handleServerError(error);
  }
}
