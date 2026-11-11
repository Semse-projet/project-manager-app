import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../../../../../_server";

function fail(error: unknown) {
  if (error instanceof Error && error.message.includes("not configured")) {
    return runtimeDisabledResponse();
  }
  return handleServerError(error);
}

export async function POST(request: NextRequest, context: { params: Promise<{ attestationId: string }> }) {
  try {
    const { attestationId } = await context.params;
    const data = await fetchSemseDataForRequest<Record<string, unknown>>(
      `/v1/me/skills/attestations/${encodeURIComponent(attestationId)}/revoke`,
      request,
      { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }
    );
    return NextResponse.json({ data });
  } catch (error) {
    return fail(error);
  }
}
