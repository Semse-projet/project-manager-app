import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError } from "../../../../_server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const { agentId } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const data = await fetchSemseDataForRequest(
      `/v1/prometeo/agents/${encodeURIComponent(agentId)}/consult`,
      request,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    return NextResponse.json({ data });
  } catch (e) {
    return handleServerError(e);
  }
}
