import { NextRequest, NextResponse } from "next/server";
import { handleServerError } from "../../../_server";
import { isGoogleMapsConfigured, searchGoogleLodging } from "../../_google";

export async function GET(request: NextRequest) {
  try {
    if (!isGoogleMapsConfigured()) {
      return NextResponse.json({
        data: { configured: false, query: "", items: [] }
      });
    }

    const query = request.nextUrl.searchParams.get("q") ?? undefined;
    const city = request.nextUrl.searchParams.get("city") ?? undefined;
    const pageSize = Number(request.nextUrl.searchParams.get("pageSize") ?? "5");
    const data = await searchGoogleLodging({ query, city, pageSize });
    return NextResponse.json({ data: { configured: true, ...data } });
  } catch (error) {
    return handleServerError(error);
  }
}
