import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError } from "../../../_server";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const data = await fetchSemseDataForRequest(
      `/v1/prometeo/documents/${encodeURIComponent(id)}`,
      request,
      { method: "DELETE" },
    );
    return NextResponse.json({ data });
  } catch (e) { return handleServerError(e); }
}
