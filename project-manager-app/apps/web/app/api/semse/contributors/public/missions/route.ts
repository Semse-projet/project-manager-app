import type { NextRequest } from "next/server";
import { fetchPublicContributorData } from "../_public";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return fetchPublicContributorData("/v1/contributor-program/missions", request);
}
