import { NextRequest, NextResponse } from "next/server";
import { handleServerError, isApiBaseConfigured, runtimeDisabledResponse, buildAuthorizedHeaders, getServerConfig } from "../_server";
import { normalizeJobRecordStatus, type JobRecordView } from "@semse/schemas";
const API = process.env.SEMSE_API_BASE_URL ?? "http://localhost:4000";

export async function GET(request: NextRequest) {
  if (!isApiBaseConfigured()) return runtimeDisabledResponse();
  try {
    const cfg = await getServerConfig(request);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    const resp = await fetch(`${API}/v1/jobs${qs}`, {
      headers: (await buildAuthorizedHeaders(cfg)),
    });
    const json = await resp.json() as { requestId: string; data: JobRecordView[] };
    if (Array.isArray(json.data)) {
      json.data = json.data.map(normalizeJobRecordStatus);
    }
    return NextResponse.json(json, { status: resp.status });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) return runtimeDisabledResponse();
    return handleServerError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const cfg  = await getServerConfig(request);
    const resp = await fetch(`${API}/v1/jobs`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(await buildAuthorizedHeaders(cfg)) },
      body: JSON.stringify(body),
    });
    const json = await resp.json();
    return NextResponse.json(json, { status: resp.status });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) return runtimeDisabledResponse();
    return handleServerError(error);
  }
}
