import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../../../../_server";

function fail(error: unknown) {
  if (error instanceof Error && error.message.includes("not configured")) {
    return runtimeDisabledResponse();
  }
  return handleServerError(error);
}

export async function POST(request: NextRequest, context: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (token.length < 16) {
      return NextResponse.json({ error: { status: 400, message: "token is required" } }, { status: 400 });
    }
    const data = await fetchSemseDataForRequest<Record<string, unknown>>(
      `/v1/organizations/${encodeURIComponent(orgId)}/skill-attestations/redeem`,
      request,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) }
    );
    return NextResponse.json({ data });
  } catch (error) {
    return fail(error);
  }
}
