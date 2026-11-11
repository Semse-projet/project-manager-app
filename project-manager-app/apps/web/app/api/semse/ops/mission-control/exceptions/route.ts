import { type NextRequest, NextResponse } from "next/server";
import {
  fetchSemseDataForAuthenticatedRequest,
  handleServerError,
  isApiBaseConfigured,
  runtimeDisabledResponse,
} from "../../../_server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!isApiBaseConfigured()) {
    return runtimeDisabledResponse();
  }
  try {
    const query = request.nextUrl.searchParams.toString();
    const data = await fetchSemseDataForAuthenticatedRequest(
      `/v1/ops/mission-control/exceptions${query ? `?${query}` : ""}`,
      request,
    );
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}
