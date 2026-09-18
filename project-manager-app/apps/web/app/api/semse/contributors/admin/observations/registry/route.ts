import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../../../../_server";

export async function GET(request: NextRequest) {
  try {
    const { search } = new URL(request.url);
    const data = await fetchSemseDataForRequest<unknown>(
      `/v1/contributor-program/admin/observations/registry${search}`,
      request
    );
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) return runtimeDisabledResponse();
    return handleServerError(error);
  }
}
