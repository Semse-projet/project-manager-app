import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError } from "../../../_server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ missionId: string }> }) {
  try {
    const { missionId } = await context.params;
    const data = await fetchSemseDataForRequest(
      `/v1/prometeo/missions/${encodeURIComponent(missionId)}`,
      request,
    );
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}
