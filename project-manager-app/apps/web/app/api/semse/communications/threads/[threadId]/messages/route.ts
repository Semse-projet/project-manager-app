import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../../../_server";
import { requireCommunicationsSession } from "../../../_auth";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    threadId: string;
  }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  if (!isApiBaseConfigured()) {
    return runtimeDisabledResponse();
  }

  try {
    const authError = await requireCommunicationsSession(request);
    if (authError) return authError;

    const { threadId } = await context.params;
    const { searchParams } = new URL(request.url);
    const qs = searchParams.toString();
    const data = await fetchSemseDataForRequest(
      `/v1/communications/threads/${encodeURIComponent(threadId)}/messages${qs ? `?${qs}` : ""}`,
      request,
    );

    return NextResponse.json({
      requestId: "web-communications-messages",
      data,
    });
  } catch (error) {
    return handleServerError(error);
  }
}
