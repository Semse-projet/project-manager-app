import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, isApiBaseConfigured, runtimeDisabledResponse } from "../_server";

export async function GET(request: NextRequest) {
  if (!isApiBaseConfigured()) return runtimeDisabledResponse();
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    const data = await fetchSemseDataForRequest<Record<string, unknown>[]>(`/v1/projects${qs}`, request);
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}
