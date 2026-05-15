import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError } from "../_server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const params = new URLSearchParams();
    for (const key of ["status", "severity", "type", "jobId", "buildOpsProjectId", "milestoneId", "limit"]) {
      const val = searchParams.get(key);
      if (val) params.set(key, val);
    }
    const query = params.toString();
    const path = `/v1/operational-intelligence/signals${query ? `?${query}` : ""}`;
    const data = await fetchSemseDataForRequest<unknown>(path, request);
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}
