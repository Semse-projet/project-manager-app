import { NextRequest, NextResponse } from "next/server";
import {
  fetchSemseDataForRequest,
  handleServerError,
  runtimeDisabledResponse
} from "../../../../../_server";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string; partNumber: string }> }
) {
  try {
    const { sessionId, partNumber } = await params;
    const partSize = request.headers.get("x-part-size") ?? "0";

    const data = await fetchSemseDataForRequest<Record<string, unknown>>(
      `/v1/uploads/multipart-session/${encodeURIComponent(sessionId)}/parts/${encodeURIComponent(partNumber)}`,
      request,
      {
        method: "PUT",
        headers: {
          "x-part-size": partSize
        }
      }
    );

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) {
      return runtimeDisabledResponse();
    }

    return handleServerError(error);
  }
}
