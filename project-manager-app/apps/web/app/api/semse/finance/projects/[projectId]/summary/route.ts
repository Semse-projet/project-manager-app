import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError } from "../../../../_server";

type Ctx = { params: Promise<{ projectId: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  try {
    const { projectId } = await params;
    const data = await fetchSemseDataForRequest(
      `/v1/finance/projects/${encodeURIComponent(projectId)}/summary`,
      request,
    );
    return NextResponse.json({ data });
  } catch (e) { return handleServerError(e); }
}
