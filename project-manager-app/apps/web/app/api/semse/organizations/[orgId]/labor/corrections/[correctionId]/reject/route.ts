import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../../../../../../_server";

function fail(error: unknown) {
  if (error instanceof Error && error.message.includes("not configured")) {
    return runtimeDisabledResponse();
  }
  return handleServerError(error);
}

export async function POST(request: NextRequest, context: { params: Promise<{ orgId: string; correctionId: string }> }) {
  try {
    const { orgId, correctionId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : undefined;
    const data = await fetchSemseDataForRequest<Record<string, unknown>>(
      `/v1/organizations/${encodeURIComponent(orgId)}/labor/corrections/${encodeURIComponent(correctionId)}/reject`,
      request,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(note ? { note } : {}) }
    );
    return NextResponse.json({ data });
  } catch (error) {
    return fail(error);
  }
}
