import { fetchPublicContributorData } from "../_public";

export const dynamic = "force-dynamic";

export async function GET() {
  return fetchPublicContributorData("/v1/contributor-program/terms/active");
}
