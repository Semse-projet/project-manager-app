import { NextResponse, type NextRequest } from "next/server";
import { fetchPublicContributorData } from "../../_public";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
    return NextResponse.json({ error: { message: "Invalid mission id" } }, { status: 400 });
  }
  return fetchPublicContributorData(`/v1/contributor-program/missions/${encodeURIComponent(id)}`, request);
}
