import { NextRequest, NextResponse } from "next/server";
import { handleServerError } from "../../../_server";
import { getGooglePlaceDetail, isGoogleMapsConfigured } from "../../_google";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ placeId: string }> }
) {
  try {
    if (!isGoogleMapsConfigured()) {
      return NextResponse.json({ data: { configured: false, item: null } });
    }

    const { placeId } = await params;
    const item = await getGooglePlaceDetail(placeId);
    return NextResponse.json({ data: { configured: true, item } });
  } catch (error) {
    return handleServerError(error);
  }
}
