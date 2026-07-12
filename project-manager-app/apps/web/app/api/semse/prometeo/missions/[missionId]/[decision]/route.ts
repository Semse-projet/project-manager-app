import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError } from "../../../../_server";

export const dynamic = "force-dynamic";

const DECISIONS = new Set(["approve", "reject", "cancel"]);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ missionId: string; decision: string }> },
) {
  try {
    const { missionId, decision } = await context.params;
    if (!DECISIONS.has(decision)) {
      return NextResponse.json({ error: { status: 404, message: "Unknown mission decision" } }, { status: 404 });
    }
    const data = await fetchSemseDataForRequest(
      `/v1/prometeo/missions/${encodeURIComponent(missionId)}/${decision}`,
      request,
      { method: "POST" },
    );
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}
