import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../_server";

/** POST /api/semse/evidence — register an uploaded file as an Evidence record.
 *  Accepts: { key, kind, milestoneId?, jobId?, projectId? }
 *  At least one of milestoneId, jobId, projectId is required (backend validates).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = await fetchSemseDataForRequest<Record<string, unknown>>(
      "/v1/evidence",
      request,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
    );
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) return runtimeDisabledResponse();
    return handleServerError(error);
  }
}
