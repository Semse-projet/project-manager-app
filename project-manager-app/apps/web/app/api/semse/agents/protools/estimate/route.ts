import { NextRequest, NextResponse } from "next/server";
import { handleServerError, runtimeDisabledResponse, buildAuthorizedHeaders, getServerConfig } from "../../../_server";
const API = process.env.SEMSE_API_BASE_URL ?? "http://localhost:4000";
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const cfg = await getServerConfig(request);
    const resp = await fetch(`${API}/v1/agents/semse/protools/estimate`, { method: "POST", headers: { "content-type": "application/json", ...(await buildAuthorizedHeaders(cfg)) }, body: JSON.stringify(body) });
    return NextResponse.json(await resp.json(), { status: resp.status });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) return runtimeDisabledResponse();
    return handleServerError(error);
  }
}
