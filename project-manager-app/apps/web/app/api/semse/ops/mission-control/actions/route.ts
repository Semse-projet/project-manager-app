import { type NextRequest, NextResponse } from "next/server";
import {
  fetchSemseDataForAuthenticatedRequest,
  handleServerError,
  isApiBaseConfigured,
  runtimeDisabledResponse,
} from "../../../_server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isApiBaseConfigured()) {
    return runtimeDisabledResponse();
  }
  try {
    const body = await request.json();
    const data = await fetchSemseDataForAuthenticatedRequest(
      "/v1/ops/mission-control/actions",
      request,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}
