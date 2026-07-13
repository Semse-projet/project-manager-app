import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError } from "../../_server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const data = await fetchSemseDataForRequest("/v1/prometeo/tools", request);
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}
