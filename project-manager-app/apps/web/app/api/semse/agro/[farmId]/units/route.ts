import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../../../_server";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ farmId: string }> },
) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();
  try {
    const { farmId } = await params;
    const data = await fetchSemseDataForRequest(`/v1/agro/farms/${encodeURIComponent(farmId)}/units`, req);
    return NextResponse.json({ requestId: `agro-units-${Date.now()}`, data });
  } catch (error) {
    return handleServerError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ farmId: string }> },
) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();
  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: { status: 400, message: "Invalid JSON body" } }, { status: 400 });
  }
  try {
    const { farmId } = await params;
    const data = await fetchSemseDataForRequest(`/v1/agro/farms/${encodeURIComponent(farmId)}/units`, req, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json({ requestId: `agro-unit-create-${Date.now()}`, data }, { status: 201 });
  } catch (error) {
    return handleServerError(error);
  }
}
