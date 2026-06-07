import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError } from "../../../_server";

export async function GET(request: NextRequest) {
  try {
    const data = await fetchSemseDataForRequest("/v1/intelligence/credentials/top?limit=10", request);
    return NextResponse.json({ data });
  } catch (e) { return handleServerError(e); }
}
