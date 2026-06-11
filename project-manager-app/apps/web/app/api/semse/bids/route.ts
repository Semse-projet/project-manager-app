import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../_server";

const SAFE_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { jobId: string; budgetMin?: number; budgetMax?: number; note?: string; availableFrom?: string };
    if (!SAFE_ID_PATTERN.test(body.jobId ?? "")) return NextResponse.json({ error: "jobId invalido" }, { status: 400 });

    const data = await fetchSemseDataForRequest(
      `/v1/jobs/${encodeURIComponent(body.jobId)}/bids`,
      request,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          budgetMin:     body.budgetMin,
          budgetMax:     body.budgetMax,
          note:          body.note,
          availableFrom: body.availableFrom,
        }),
      }
    );
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) return runtimeDisabledResponse();
    return handleServerError(error);
  }
}
