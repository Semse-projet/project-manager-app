import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError } from "../../../../_server";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;
    const data = await fetchSemseDataForRequest<unknown>(
      `/v1/consciousness/simulations/${id}/diff`,
      request,
    );
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}
