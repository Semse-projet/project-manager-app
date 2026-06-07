import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../../../_server";

const allowedActions = new Set(["submit", "approve", "reject"]);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; action: string }> }
) {
  try {
    const { id, action } = await context.params;
    if (!allowedActions.has(action)) {
      return NextResponse.json({ error: { status: 404, message: "Unknown change order action" } }, { status: 404 });
    }
    const rawBody = (await request.text()).trim();
    const body = rawBody.length > 0 ? JSON.parse(rawBody) : {};
    const data = await fetchSemseDataForRequest<unknown>(`/v1/change-orders/${id}/${action}`, request, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) return runtimeDisabledResponse();
    return handleServerError(error);
  }
}
