import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError } from "../../../_server";

export async function GET(request: NextRequest) {
  try {
    const data = await fetchSemseDataForRequest("/v1/payments/connect/account", request);
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const data = await fetchSemseDataForRequest("/v1/payments/connect/account", request, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}
