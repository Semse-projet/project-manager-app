import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../../../_server";

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
      `/v1/organizations/${encodeURIComponent(orgId)}/offers${qs}`,
      request
    );
    return NextResponse.json({ data });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const recipientUserId = typeof body.recipientUserId === "string" ? body.recipientUserId.trim() : "";
    const positionTitle = typeof body.positionTitle === "string" ? body.positionTitle.trim() : "";
    const classification = typeof body.classification === "string" ? body.classification : "";
    if (!recipientUserId || positionTitle.length < 2 || !["W2", "1099", "OTHER"].includes(classification)) {
      return NextResponse.json({ error: { status: 400, message: "Invalid offer payload" } }, { status: 400 });
    }
    const compensationNote = typeof body.compensationNote === "string" && body.compensationNote.trim() ? body.compensationNote.trim() : undefined;
    const data = await fetchSemseDataForRequest<Record<string, unknown>>(
      `/v1/organizations/${encodeURIComponent(orgId)}/offers`,
      request,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recipientUserId, positionTitle, classification, ...(compensationNote ? { compensationNote } : {}) })
      }
    );
    return NextResponse.json({ data });
  } catch (error) {
    return fail(error);
  }
}
