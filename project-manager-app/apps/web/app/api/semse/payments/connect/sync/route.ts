import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError } from "../../../_server";

export async function POST(request: NextRequest) {
  try {
    const data = await fetchSemseDataForRequest("/v1/payments/connect/sync", request, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}
