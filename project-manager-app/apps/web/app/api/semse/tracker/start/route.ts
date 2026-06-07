import { type NextRequest, NextResponse } from "next/server";
import {
  type TrackerSessionView,
  startTrackerSessionSchema
} from "@semse/schemas";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../_server";

export async function POST(req: NextRequest) {
  if (!isApiBaseConfigured()) {
    return runtimeDisabledResponse();
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const parsed = startTrackerSessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { status: 400, message: "Invalid tracker start payload", details: parsed.error.flatten() } },
        { status: 400 }
      );
    }

    const data = await fetchSemseDataForRequest<TrackerSessionView>("/v1/field-ops/tracker/start", req, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.data),
    });

    return NextResponse.json({ requestId: "web-tracker-start", data }, { status: 201 });
  } catch (error) {
    return handleServerError(error);
  }
}
