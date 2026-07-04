import { type NextRequest, NextResponse } from "next/server";
import {
  type TrackerSessionView,
  trackerSessionMutationSchema,
} from "@semse/schemas";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../../../_server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  if (!isApiBaseConfigured()) {
    return runtimeDisabledResponse();
  }

  try {
    const { sessionId } = await params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = trackerSessionMutationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { status: 400, message: "Invalid time tracker resume payload", details: parsed.error.flatten() } },
        { status: 400 },
      );
    }

    const data = await fetchSemseDataForRequest<TrackerSessionView>(
      `/v1/time-tracker/sessions/${encodeURIComponent(sessionId)}/resume`,
      req,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      },
    );

    return NextResponse.json({ requestId: "web-time-tracker-resume", data });
  } catch (error) {
    return handleServerError(error);
  }
}
