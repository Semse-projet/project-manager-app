import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError } from "../../_server";

// Mobile-app-facing login BFF. Proxies to POST /v1/auth/login and returns
// the token in the response body (not as a cookie) so native/mobile clients
// can store it and use it as a Bearer token.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const data = await fetchSemseDataForRequest<{
      token: string;
      accessToken?: string;
      userId?: string;
      tenantId?: string;
      orgId?: string;
      roles?: string[];
    }>("/v1/auth/login", request, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}
