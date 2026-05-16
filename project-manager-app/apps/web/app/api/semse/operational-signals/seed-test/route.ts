import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError } from "../../_server";

export async function POST(request: NextRequest) {
  try {
    const data = await fetchSemseDataForRequest(
      "/v1/operational-intelligence/seed-test",
      request,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
    );
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}
