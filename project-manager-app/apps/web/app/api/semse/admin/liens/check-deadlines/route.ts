import type { NextRequest } from "next/server";
import { proxyAuthenticated } from "../../../_authenticated-proxy";

export const dynamic = "force-dynamic";

// Manual trigger of the hourly lien-deadline scheduler. `reset-alerts` is a
// testing-only endpoint and is intentionally not exposed through the BFF.
export async function POST(request: NextRequest) {
  return proxyAuthenticated(request, "/v1/admin/liens/check-deadlines", { method: "POST" });
}
