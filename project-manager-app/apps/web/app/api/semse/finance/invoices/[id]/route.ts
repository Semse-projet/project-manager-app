import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError } from "../../../_server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const data = await fetchSemseDataForRequest(`/v1/finance/invoices/${encodeURIComponent(id)}`, request);
    return NextResponse.json({ data });
  } catch (e) { return handleServerError(e); }
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = await request.json() as Record<string, unknown>;
    const data = await fetchSemseDataForRequest(
      `/v1/finance/invoices/${encodeURIComponent(id)}`,
      request,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    );
    return NextResponse.json({ data });
  } catch (e) { return handleServerError(e); }
}
