import { type NextRequest, NextResponse } from "next/server";
import {
  createManualTrackerSessionSchema,
  type TrackerSessionView,
} from "@semse/schemas";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../../_server";

export async function POST(req: NextRequest) {
  if (!isApiBaseConfigured()) {
    return runtimeDisabledResponse();
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const parsed = createManualTrackerSessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { status: 400, message: "Invalid manual time tracker payload", details: parsed.error.flatten() } },
        { status: 400 },
      );
    }

    const data = await fetchSemseDataForRequest<TrackerSessionView>("/v1/time-tracker/sessions/manual", req, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.data),
    });

    return NextResponse.json({ requestId: "web-time-tracker-manual", data }, { status: 201 });
  } catch (error) {
    return handleServerError(error);
  }
}
