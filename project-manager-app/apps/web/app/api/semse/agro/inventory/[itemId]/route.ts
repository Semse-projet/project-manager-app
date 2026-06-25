import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../../../../_server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();
  try {
    const { itemId } = await params;
    const data = await fetchSemseDataForRequest<unknown>(`/v1/agro/inventory/items/${itemId}`, req);
    return NextResponse.json({ data });
  } catch (err) {
    return handleServerError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();
  try {
    const { itemId } = await params;
    const body = await req.json();
    const data = await fetchSemseDataForRequest<unknown>(`/v1/agro/inventory/items/${itemId}`, req, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json({ data });
  } catch (err) {
    return handleServerError(err);
  }
}
