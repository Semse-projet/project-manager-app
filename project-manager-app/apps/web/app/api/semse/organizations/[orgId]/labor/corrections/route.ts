import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../../../../_server";

function fail(error: unknown) {
  if (error instanceof Error && error.message.includes("not configured")) {
    return runtimeDisabledResponse();
  }
  return handleServerError(error);
}

export async function GET(request: NextRequest, context: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await context.params;
    const status = request.nextUrl.searchParams.get("status");
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    const data = await fetchSemseDataForRequest<Record<string, unknown>[]>(
      `/v1/organizations/${encodeURIComponent(orgId)}/labor/corrections${qs}`,
      request
    );
    return NextResponse.json({ data });
  } catch (error) {
    return fail(error);
  }
}
