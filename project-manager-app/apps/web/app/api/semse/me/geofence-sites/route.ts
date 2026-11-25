import type { NextRequest } from "next/server";
import { proxyAuthenticated } from "../../_authenticated-proxy";

// OPEN-18 (docs/specs/core/worksite-location-binding.spec.md): worksites linked to the
// person's jobs/free projects, with the WORKSITE's location and radius. Self-service only;
// 404 while SEMSE_WORKSITE_BINDING_ENABLED is off (the tracker keeps the legacy mode).
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return proxyAuthenticated(request, "/v1/me/geofence-sites");
}
