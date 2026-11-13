import type { NextRequest } from "next/server";
import { proxyAuthenticated } from "../../_authenticated-proxy";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return proxyAuthenticated(request, "/v1/forge/mission-control");
}
