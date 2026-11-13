import type { NextRequest } from "next/server";
import { proxyAuthenticated } from "../../_authenticated-proxy";

// Transparency (AC-11): the person's own last decisions. Read-only from the
// web; events are reported by the mobile app.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return proxyAuthenticated(request, "/v1/me/geofence-events");
}
