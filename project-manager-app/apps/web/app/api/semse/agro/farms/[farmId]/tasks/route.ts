import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isSemseRuntimeEnabled, runtimeDisabledResponse } from "../../../../_server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ farmId: string }> }) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();
  try {
    const { farmId } = await params;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? undefined;
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    const data = await fetchSemseDataForRequest<unknown>(`/v1/agro/farms/${farmId}/tasks${qs}`, req);
    return NextResponse.json({ data });
  } catch (err) {
    return handleServerError(err);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ farmId: string }> }) {
  if (!isSemseRuntimeEnabled()) return runtimeDisabledResponse();
  try {
    const { farmId } = await params;
    const body = await req.json();
    const data = await fetchSemseDataForRequest<unknown>(`/v1/agro/farms/${farmId}/tasks`, req, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    return handleServerError(err);
  }
}
