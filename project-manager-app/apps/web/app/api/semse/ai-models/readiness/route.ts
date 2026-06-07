import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError } from "../../_server";

export async function GET(request: NextRequest) {
  try {
    const data = await fetchSemseDataForRequest("/v1/ai-models/readiness", request);
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}
