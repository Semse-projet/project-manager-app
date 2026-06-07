import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../_server";

export async function POST(request: NextRequest) {
  if (!isApiBaseConfigured()) return runtimeDisabledResponse();
  try {
    const body = await request.json() as Record<string, unknown>;
    const data = await fetchSemseDataForRequest<Record<string, unknown>>(
      "/v1/agents/copilot",
      request,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    );
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}
