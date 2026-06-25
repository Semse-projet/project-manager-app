import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../../../../_server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();
  try {
    const { taskId } = await params;
    const data = await fetchSemseDataForRequest<unknown>(`/v1/agro/tasks/${taskId}/complete`, req, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    return NextResponse.json({ data });
  } catch (err) {
    return handleServerError(err);
  }
}
