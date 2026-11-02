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
    const data = await fetchSemseDataForAuthenticatedRequest(
      "/v1/ops/mission-control/runbooks",
      request,
    );
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}
