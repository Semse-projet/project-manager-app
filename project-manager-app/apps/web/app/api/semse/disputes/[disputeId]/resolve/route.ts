import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../../../_server";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ disputeId: string }> }
) {
  try {
    const { disputeId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const resolution = typeof body.resolution === "string" ? body.resolution.trim() : "";

    if (!resolution) {
      return NextResponse.json(
        {
          error: {
            status: 400,
            message: "resolution is required"
          }
        },
        { status: 400 }
      );
    }

    const data = await fetchSemseDataForRequest<Record<string, unknown>>(`/v1/disputes/${disputeId}/resolve`, request, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ resolution })
    });

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) {
      return runtimeDisabledResponse();
    }
    return handleServerError(error);
  }
}
