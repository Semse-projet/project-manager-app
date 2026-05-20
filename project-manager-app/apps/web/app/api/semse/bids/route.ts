import { NextRequest, NextResponse } from "next/server";
import { handleServerError, runtimeDisabledResponse, buildSemseRequestHeaders, getServerConfig } from "../_server";

const API = process.env.SEMSE_API_BASE_URL ?? "http://localhost:4000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { jobId: string; budgetMin?: number; budgetMax?: number; note?: string; availableFrom?: string };
    if (!body.jobId) return NextResponse.json({ error: "jobId requerido" }, { status: 400 });

    const cfg = await getServerConfig(request);
    const resp = await fetch(`${API}/v1/jobs/${body.jobId}/bids`, {
      method: "POST",
      headers: { "content-type": "application/json", ...buildSemseRequestHeaders(cfg) },
      body: JSON.stringify({
        budgetMin:     body.budgetMin,
        budgetMax:     body.budgetMax,
        note:          body.note,
        availableFrom: body.availableFrom,
      }),
    });
    const json = await resp.json();
    return NextResponse.json(json, { status: resp.status });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) return runtimeDisabledResponse();
    return handleServerError(error);
  }
}
