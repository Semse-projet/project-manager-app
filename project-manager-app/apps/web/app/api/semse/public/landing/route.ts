import { type NextRequest, NextResponse } from "next/server";
import { fetchPublicLandingOverviewServer } from "../../../../../lib/public-landing";

export async function GET(_request: NextRequest) {
  try {
    const data = await fetchPublicLandingOverviewServer();
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }
}
