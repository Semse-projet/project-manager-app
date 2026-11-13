import type { NextRequest } from "next/server";
import { proxyAuthenticated, readJsonBody } from "../../_authenticated-proxy";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return proxyAuthenticated(request, "/v1/satellites/tokens");
}

// The raw `sst_` token only exists in this response; the API stores a hash.
export async function POST(request: NextRequest) {
  const body = await readJsonBody(request);
  return proxyAuthenticated(request, "/v1/satellites/tokens", {
    method: "POST",
    body: { name: body.name, scopes: body.scopes, ...(body.expiresAt ? { expiresAt: body.expiresAt } : {}) },
    status: 201
  });
}
