import type { NextRequest } from "next/server";
import { proxyAuthenticated, readJsonBody } from "../../_authenticated-proxy";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return proxyAuthenticated(request, "/v1/forge/runs");
}

export async function POST(request: NextRequest) {
  const body = await readJsonBody(request);
  return proxyAuthenticated(request, "/v1/forge/runs", {
    method: "POST",
    body: { title: body.title, spec: body.spec },
    status: 201
  });
}
