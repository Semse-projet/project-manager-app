import { NextRequest, NextResponse } from "next/server";
import { buildAuthorizedHeaders, getServerConfig, handleServerError, runtimeDisabledResponse } from "../_server";

const API = process.env.SEMSE_API_BASE_URL ?? "http://localhost:4000";

export async function GET(request: NextRequest) {
  try {
    const jobId = request.nextUrl.searchParams.get("jobId");
    const milestoneId = request.nextUrl.searchParams.get("milestoneId");
    const cfg = await getServerConfig(request);
    const headers = (await buildAuthorizedHeaders(cfg));

    const timeline = request.nextUrl.searchParams.get("timeline");
    const fps = request.nextUrl.searchParams.get("fps");
    let path = "/v1/vision/job/all";
    if (jobId && timeline === "1") {
      path = `/v1/vision/job/${encodeURIComponent(jobId)}/timeline${fps ? `?fps=${encodeURIComponent(fps)}` : ""}`;
    } else if (jobId) path = `/v1/vision/job/${encodeURIComponent(jobId)}`;
    else if (milestoneId) path = `/v1/vision/milestone/${encodeURIComponent(milestoneId)}`;

    const resp = await fetch(`${API}${path}`, { headers });
    const json = await resp.json();
    return NextResponse.json(json, { status: resp.status });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) return runtimeDisabledResponse();
    return handleServerError(error);
  }
}

const ALLOWED_VISION_ENDPOINTS = new Set([
  "analyze",
  "batch",
  "batch-by-ids",
  "detect-trade",
  "estimate-area",
  "check-consistency",
  "consistency-by-ids",
  "progress-timeline",
  "match-reference",
  "safety-check",
  "safety-check-enriched",
  "blueprint",
  "perspective-correct",
  "document-binarize",
  "detect-material",
  "classify-space",
  "analyze-portfolio",
]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const rawEndpoint = String(body.endpoint ?? "analyze");
    if (!ALLOWED_VISION_ENDPOINTS.has(rawEndpoint)) {
      return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 });
    }
    const cfg = await getServerConfig(request);
    const headers = { "content-type": "application/json", ...(await buildAuthorizedHeaders(cfg)) };

    const resp = await fetch(`${API}/v1/vision/${rawEndpoint}`, {
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
