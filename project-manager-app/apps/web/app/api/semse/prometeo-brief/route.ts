import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError } from "../_server";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("buildOpsProjectId");
    const path = projectId
      ? `/v1/operational-intelligence/brief?buildOpsProjectId=${encodeURIComponent(projectId)}`
      : "/v1/operational-intelligence/brief";
    const data = await fetchSemseDataForRequest<unknown>(path, request);
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}
