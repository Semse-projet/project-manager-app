import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError } from "../../../../_server";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const data = await fetchSemseDataForRequest(
      `/v1/finance/invoices/${encodeURIComponent(id)}/pay`,
      request,
      { method: "POST" },
    );
    return NextResponse.json({ data });
  } catch (e) { return handleServerError(e); }
}
