import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError } from "../../_server";

export async function GET(request: NextRequest) {
  try {
    const data = await fetchSemseDataForRequest<unknown>(
      "/v1/consciousness/simulations",
      request,
    );
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}
