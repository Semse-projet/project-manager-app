import { NextRequest, NextResponse } from "next/server";
import { handleServerError, runtimeDisabledResponse, buildSemseRequestHeaders, getServerConfig } from "../_server";

const API = process.env.SEMSE_API_BASE_URL ?? "http://localhost:4000";

export async function GET(request: NextRequest) {
  try {
    const cfg = await getServerConfig(request);
    const headers = { "content-type": "application/json", ...buildSemseRequestHeaders(cfg) };
    const resp = await fetch(`${API}/v1/bids/mine`, { headers });
    if (!resp.ok) return runtimeDisabledResponse();
    const json = await resp.json() as { data: unknown };
    return NextResponse.json({ data: json.data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) return runtimeDisabledResponse();
    return handleServerError(error);
  }
}
