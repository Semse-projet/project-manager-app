import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../../_server";
import { parseSafePayoutMethodPayload } from "../../../../../lib/payout-method-security";

export async function GET(request: NextRequest) {
  try {
    const data = await fetchSemseDataForRequest<Record<string, unknown> | null>("/v1/workers/me/payout-method", request);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("not configured")) {
        return runtimeDisabledResponse();
      }
      if (error.message.includes("404")) {
        return NextResponse.json({ data: null });
      }
    }
    return handleServerError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = parseSafePayoutMethodPayload(await request.json());
    if (!parsed.ok) {
      return NextResponse.json(
        { error: { status: 400, message: parsed.error } },
        { status: 400 }
      );
    }

    const data = await fetchSemseDataForRequest<Record<string, unknown>>("/v1/workers/me/payout-method", request, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.data),
    });

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("not configured") || error.message.includes("404")) {
        return NextResponse.json({ data: { saved: true, mock: true } });
      }
    }
    return handleServerError(error);
  }
}
