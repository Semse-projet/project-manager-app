import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../../../../_server";

export const dynamic = "force-dynamic";

const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;

/** Decisión humana sobre una propuesta del loop. Body: { outcome: "accepted" | "rejected" }. */
export async function POST(request: NextRequest, context: { params: Promise<{ decisionId: string }> }) {
  if (!isApiBaseConfigured()) {
    return runtimeDisabledResponse();
  }

  try {
    const { decisionId } = await context.params;
    if (!SAFE_ID.test(decisionId)) {
      return NextResponse.json({ error: "decisionId invalido" }, { status: 400 });
    }
    const body = (await request.json()) as { outcome?: string };
    if (body.outcome !== "accepted" && body.outcome !== "rejected") {
      return NextResponse.json({ error: "outcome debe ser \"accepted\" o \"rejected\"" }, { status: 400 });
    }
    const data = await fetchSemseDataForRequest(
      `/v1/ops/loops/decisions/${encodeURIComponent(decisionId)}/resolve`,
      request,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ outcome: body.outcome }) }
    );
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}
