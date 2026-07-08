import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../../../_server";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ recordId: string }> }) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();
  try {
    const { recordId } = await params;
    const data = await fetchSemseDataForRequest<unknown>(`/v1/agro/production/${recordId}`, req, { method: "DELETE" });
    return NextResponse.json({ data });
  } catch (err) {
    return handleServerError(err);
  }
}
