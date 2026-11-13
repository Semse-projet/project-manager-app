import type { NextRequest } from "next/server";
import { proxyAuthenticated } from "../../_authenticated-proxy";

export const dynamic = "force-dynamic";

// Admin view (satellites:admin): every registered webhook across satellites.
export async function GET(request: NextRequest) {
  return proxyAuthenticated(request, "/v1/satellites/webhooks");
}
