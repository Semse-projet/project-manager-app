import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError } from "../../../../_server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = await fetchSemseDataForRequest(`/v1/contractor/leads/${id}/suggest-estimate`, request, { method: "POST" });
    return NextResponse.json({ data });
  } catch (e) { return handleServerError(e); }
}
