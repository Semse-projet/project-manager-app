import { NextRequest, NextResponse } from "next/server";
import { buildSemseRequestHeaders, getServerConfig, handleServerError, runtimeDisabledResponse } from "../_server";

const API = process.env.SEMSE_API_BASE_URL ?? "http://localhost:4000";

export async function GET(request: NextRequest) {
  try {
    const jobId = request.nextUrl.searchParams.get("jobId");
    const milestoneId = request.nextUrl.searchParams.get("milestoneId");
    const cfg = await getServerConfig(request);
    const headers = buildSemseRequestHeaders(cfg);

    let path = "/v1/vision/job/all";
    if (jobId) path = `/v1/vision/job/${encodeURIComponent(jobId)}`;
    else if (milestoneId) path = `/v1/vision/milestone/${encodeURIComponent(milestoneId)}`;

    const resp = await fetch(`${API}${path}`, { headers });
    const json = await resp.json();
    return NextResponse.json(json, { status: resp.status });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) return runtimeDisabledResponse();
    return handleServerError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const endpoint = String(body.endpoint ?? "analyze");
    const cfg = await getServerConfig(request);
    const headers = { "content-type": "application/json", ...buildSemseRequestHeaders(cfg) };

    const resp = await fetch(`${API}/v1/vision/${endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body.payload ?? body),
    });
    const json = await resp.json();
    return NextResponse.json(json, { status: resp.status });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) return runtimeDisabledResponse();
    return handleServerError(error);
  }
}
