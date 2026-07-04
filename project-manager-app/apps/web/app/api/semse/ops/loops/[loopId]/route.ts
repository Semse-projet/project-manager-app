import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../../_server";

export const dynamic = "force-dynamic";

const SAFE_LOOP_ID = /^[a-z0-9.:_-]{1,64}$/;
const ACTIONS = new Set(["pause", "resume"]);

/** Hallazgos y propuestas recientes del loop. */
export async function GET(request: NextRequest, context: { params: Promise<{ loopId: string }> }) {
  if (!isApiBaseConfigured()) {
    return runtimeDisabledResponse();
  }

  try {
    const { loopId } = await context.params;
    if (!SAFE_LOOP_ID.test(loopId)) {
      return NextResponse.json({ error: "loopId invalido" }, { status: 400 });
    }
    const data = await fetchSemseDataForRequest(`/v1/ops/loops/${encodeURIComponent(loopId)}/decisions`, request);
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}

/** Pause / resume del loop (kill switch admin). Body: { action: "pause" | "resume" }. */
export async function POST(request: NextRequest, context: { params: Promise<{ loopId: string }> }) {
  if (!isApiBaseConfigured()) {
    return runtimeDisabledResponse();
  }

  try {
    const { loopId } = await context.params;
    if (!SAFE_LOOP_ID.test(loopId)) {
      return NextResponse.json({ error: "loopId invalido" }, { status: 400 });
    }
    const body = (await request.json()) as { action?: string };
    if (!body.action || !ACTIONS.has(body.action)) {
      return NextResponse.json({ error: "action debe ser \"pause\" o \"resume\"" }, { status: 400 });
    }
    const data = await fetchSemseDataForRequest(
      `/v1/ops/loops/${encodeURIComponent(loopId)}/${body.action}`,
      request,
      { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }
    );
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}
