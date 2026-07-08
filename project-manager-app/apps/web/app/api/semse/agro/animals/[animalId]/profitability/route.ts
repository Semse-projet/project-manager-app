import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../../../../_server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ animalId: string }> }) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();
  try {
    const { animalId } = await params;
    const data = await fetchSemseDataForRequest<unknown>(`/v1/agro/animals/${animalId}/profitability`, req);
    return NextResponse.json({ data });
  } catch (err) {
    return handleServerError(err);
  }
}
