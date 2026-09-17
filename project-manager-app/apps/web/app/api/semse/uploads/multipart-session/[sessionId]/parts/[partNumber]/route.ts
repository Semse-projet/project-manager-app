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

    // The previous version never read the request body at all, so every
    // part "upload" silently discarded the chunk's bytes before they even
    // reached the API — the same data-loss bug fixed server-side in
    // evidence.controller.ts, one layer up the stack. Forward the raw bytes,
    // the same way the single-PUT /uploads/files/[...key] route already does.
    const body = await request.arrayBuffer();

    const data = await fetchSemseDataForRequest<Record<string, unknown>>(
      `/v1/uploads/multipart-session/${encodeURIComponent(sessionId)}/parts/${encodeURIComponent(partNumber)}`,
      request,
      {
        method: "PUT",
        headers: {
          "content-length": String(body.byteLength),
          "x-part-size": String(body.byteLength)
        },
        body
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
