import type { NextRequest } from "next/server";
import { proxyAuthenticated, readJsonBody } from "../../_authenticated-proxy";

// Transparency (AC-11): the person's own last decisions.
// OPEN-18 (W-07): the web tracker also reports arrivals at linked worksites so the
// server decides. Only whitelisted fields are forwarded — never coordinates.
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return proxyAuthenticated(request, "/v1/me/geofence-events");
}

export async function POST(request: NextRequest) {
  const body = await readJsonBody(request);
  const site = body.site && typeof body.site === "object" ? (body.site as Record<string, unknown>) : undefined;
  return proxyAuthenticated(request, "/v1/me/geofence-events", {
    method: "POST",
    body: {
      eventId: body.eventId,
      type: body.type,
      occurredAt: body.occurredAt,
      ...(site ? { site: { kind: site.kind, id: site.id } } : {}),
      ...(typeof body.worksiteId === "string" ? { worksiteId: body.worksiteId } : {}),
      ...(typeof body.accuracyMeters === "number" ? { accuracyMeters: body.accuracyMeters } : {})
    }
  });
}
