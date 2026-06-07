import { NextRequest, NextResponse } from "next/server";
import {
  fetchSemseDataForRequest,
  handleServerError,
  runtimeDisabledResponse
} from "../../../_server";

const allowed = new Set(["submit", "approve", "reject", "request-changes"]);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ milestoneId: string; action: string }> }
) {
  try {
    const { milestoneId, action } = await context.params;
    if (!allowed.has(action)) {
      return NextResponse.json({ error: { status: 404, message: "Unknown milestone action" } }, { status: 404 });
    }

    const rawBody = (await request.text()).trim();
    const body = rawBody.length > 0 ? JSON.parse(rawBody) : undefined;

    const data = await fetchSemseDataForRequest<Record<string, unknown>>(
      `/v1/milestones/${milestoneId}/${action}`,
      request,
      {
        method: "POST",
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined
      }
    );

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) {
      return runtimeDisabledResponse();
    }

    return handleServerError(error);
  }
}
