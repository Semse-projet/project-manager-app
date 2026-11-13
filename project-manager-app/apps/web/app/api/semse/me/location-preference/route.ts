import type { NextRequest } from "next/server";
import { proxyAuthenticated, readJsonBody } from "../../_authenticated-proxy";

// Spec: docs/specs/core/geofence-policy.spec.md v0.2. Self-service only: the
// API scopes everything to the signed-in person. Flag off → 404.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return proxyAuthenticated(request, "/v1/me/location-preference");
}

export async function PUT(request: NextRequest) {
  const body = await readJsonBody(request);
  return proxyAuthenticated(request, "/v1/me/location-preference", {
    method: "PUT",
    body: {
      mode: body.mode,
      ...(typeof body.autoStartConsent === "boolean" ? { autoStartConsent: body.autoStartConsent } : {})
    }
  });
}
