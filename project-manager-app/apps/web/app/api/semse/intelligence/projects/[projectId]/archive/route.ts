import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError } from "../../../../_server";

type Ctx = { params: Promise<{ projectId: string }> };
export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const { projectId } = await params;
    const data = await fetchSemseDataForRequest(`/v1/intelligence/projects/${encodeURIComponent(projectId)}/archive`, request, { method: "POST" });
    return NextResponse.json({ data });
  } catch (e) { return handleServerError(e); }
}
