import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../../_server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId") ?? "";
    const kind = searchParams.get("kind");
    const agentId = searchParams.get("agentId");
    const limit = searchParams.get("limit") ?? "50";

    const qs = new URLSearchParams();
    if (workspaceId) qs.set("workspaceId", workspaceId);
    if (kind) qs.set("kinds", kind);
    if (agentId) qs.set("agentId", agentId);
    qs.set("limit", limit);

    const url = `/v1/knowledge/workspace-memory?${qs.toString()}`;
    const data = await fetchSemseDataForRequest(url, request);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) {
      return runtimeDisabledResponse();
    }
    return handleServerError(error);
  }
}
