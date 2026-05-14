import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../_server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const upstreamParams = new URLSearchParams();
    ["jobId", "buildOpsProjectId", "milestoneId", "status", "limit"].forEach((key) => {
      const value = searchParams.get(key);
      if (value) upstreamParams.set(key, value);
    });
    const suffix = upstreamParams.size ? `?${upstreamParams.toString()}` : "";
    const data = await fetchSemseDataForRequest<unknown[]>(`/v1/change-orders${suffix}`, request);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) return runtimeDisabledResponse();
    return handleServerError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = await fetchSemseDataForRequest<unknown>("/v1/change-orders", request, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) return runtimeDisabledResponse();
    return handleServerError(error);
  }
}
