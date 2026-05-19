import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../../../_server";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ threadId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!isApiBaseConfigured()) return runtimeDisabledResponse();
  try {
    const { threadId } = await context.params;
    const body = await request.json();
    const data = await fetchSemseDataForRequest(
      `/v1/communications/threads/${encodeURIComponent(threadId)}`,
      request,
      { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
    );
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}
