import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../_server";

export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get("status") ?? undefined;
    const jobId  = request.nextUrl.searchParams.get("jobId")  ?? undefined;
    const assignedTo = request.nextUrl.searchParams.get("assignedTo") ?? undefined;
    const scope = request.nextUrl.searchParams.get("scope") ?? undefined;
    const qs = new URLSearchParams();
    if (status) qs.set("status", status);
    if (jobId)  qs.set("jobId",  jobId);
    if (assignedTo) qs.set("assignedTo", assignedTo);
    if (scope) qs.set("scope", scope);
    const q = qs.toString() ? `?${qs.toString()}` : "";
    const data = await fetchSemseDataForRequest(`/v1/travel${q}`, request);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) {
      return runtimeDisabledResponse();
    }
    return handleServerError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = await fetchSemseDataForRequest("/v1/travel", request, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) {
      return runtimeDisabledResponse();
    }
    return handleServerError(error);
  }
}
