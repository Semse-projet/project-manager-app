import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../_server";

const SAFE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { jobId: string; amount?: number; etaDays?: number; note?: string; proOrgId?: string };
    if (!SAFE_ID_PATTERN.test(body.jobId ?? "")) return NextResponse.json({ error: "jobId invalido" }, { status: 400 });
    if (!body.amount || body.amount <= 0) return NextResponse.json({ error: "amount requerido y positivo" }, { status: 400 });
    if (!body.etaDays || body.etaDays <= 0) return NextResponse.json({ error: "etaDays requerido y positivo" }, { status: 400 });

    const payload: Record<string, unknown> = { amount: body.amount, etaDays: body.etaDays };
    if (body.note) payload.note = body.note;

    const data = await fetchSemseDataForRequest(
      `/v1/jobs/${encodeURIComponent(body.jobId)}/bids`,
      request,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) return runtimeDisabledResponse();
    return handleServerError(error);
  }
}
