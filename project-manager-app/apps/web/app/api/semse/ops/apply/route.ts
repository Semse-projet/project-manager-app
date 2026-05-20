import { NextRequest, NextResponse } from "next/server";
import { handleServerError, runtimeDisabledResponse, buildSemseRequestHeaders, getServerConfig } from "../../_server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { recId: string; confirmed: boolean };
    const cfg  = await getServerConfig(request);
    const API  = process.env.SEMSE_API_BASE_URL ?? "http://localhost:4000";

    const resp = await fetch(`${API}/v1/ops/apply/${body.recId}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...buildSemseRequestHeaders(cfg) },
      body: JSON.stringify({ confirmed: body.confirmed }),
    });
    const json = await resp.json();
    return NextResponse.json(json, { status: resp.status });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) return runtimeDisabledResponse();
    return handleServerError(error);
  }
}
