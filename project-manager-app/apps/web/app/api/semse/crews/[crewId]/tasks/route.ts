import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../../../_server";

function fail(error: unknown) {
  if (error instanceof Error && error.message.includes("not configured")) {
    return runtimeDisabledResponse();
  }
  return handleServerError(error);
}

type Ctx = { params: Promise<{ crewId: string }> };

export async function GET(request: NextRequest, context: Ctx) {
  try {
    const { crewId } = await context.params;
    const data = await fetchSemseDataForRequest<Record<string, unknown>[]>(`/v1/crews/${encodeURIComponent(crewId)}/tasks`, request);
    return NextResponse.json({ data });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest, context: Ctx) {
  try {
    const { crewId } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (title.length < 2) {
      return NextResponse.json({ error: { status: 400, message: "title is required" } }, { status: 400 });
    }
    const payload: Record<string, unknown> = { title };
    if (typeof body.description === "string" && body.description.trim()) payload.description = body.description.trim();
    if (typeof body.priority === "string" && ["low", "medium", "high", "urgent"].includes(body.priority)) payload.priority = body.priority;
    const data = await fetchSemseDataForRequest<Record<string, unknown>>(`/v1/crews/${encodeURIComponent(crewId)}/tasks`, request, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
    return NextResponse.json({ data });
  } catch (error) {
    return fail(error);
  }
}
