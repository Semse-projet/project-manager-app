import { NextRequest, NextResponse } from "next/server";
import { handleServerError } from "../../_server";
import { geocodeGoogleAddress, isGoogleMapsConfigured } from "../_google";

export async function GET(request: NextRequest) {
  try {
    if (!isGoogleMapsConfigured()) {
      return NextResponse.json({ data: { configured: false, item: null } });
    }

    const address = request.nextUrl.searchParams.get("address")?.trim();
    if (!address) {
      return NextResponse.json(
        { error: { status: 400, message: "address is required" } },
        { status: 400 }
      );
    }

    const item = await geocodeGoogleAddress(address);
    return NextResponse.json({ data: { configured: true, item } });
  } catch (error) {
    return handleServerError(error);
  }
}
