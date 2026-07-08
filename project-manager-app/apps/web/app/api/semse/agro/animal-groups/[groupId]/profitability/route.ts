import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../../../../_server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();
  try {
    const { groupId } = await params;
    const data = await fetchSemseDataForRequest<unknown>(`/v1/agro/animal-groups/${groupId}/profitability`, req);
    return NextResponse.json({ data });
  } catch (err) {
    return handleServerError(err);
  }
}
