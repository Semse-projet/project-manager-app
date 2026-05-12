import { NextRequest, NextResponse } from "next/server";
import { fetchSemseData, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../../../../_server";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { status: 400, message: "Invalid JSON body" } }, { status: 400 });
  }

  try {
    const { projectId } = await params;
    const data = await fetchSemseData(
      `/v1/buildops/plans/${encodeURIComponent(projectId)}/approve`,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
    );
    return NextResponse.json({ requestId: `buildops-plan-approve-${Date.now()}`, data });
  } catch (error) {
    return handleServerError(error);
  }
}
