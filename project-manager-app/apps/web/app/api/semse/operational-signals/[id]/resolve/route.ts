import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError } from "../../../_server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const data = await fetchSemseDataForRequest(
      `/v1/operational-intelligence/signals/${encodeURIComponent(id)}/resolve`,
      request,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}" },
    );
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}
