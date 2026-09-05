import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError } from "../../../_server";

type Context = { params: Promise<{ projectId: string }> };

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { projectId } = await params;
    const data = await fetchSemseDataForRequest(
      `/v1/projects/${encodeURIComponent(projectId)}/projection`,
      request,
    );
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}
