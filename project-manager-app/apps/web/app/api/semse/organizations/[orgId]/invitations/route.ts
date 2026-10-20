import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForAuthenticatedRequest, handleServerError, runtimeDisabledResponse } from "../../../_server";

function fail(error: unknown) {
  if (error instanceof Error && error.message.includes("not configured")) {
    return runtimeDisabledResponse();
  }
  return handleServerError(error);
}

export async function GET(request: NextRequest, context: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await context.params;
    const status = request.nextUrl.searchParams.get("status");
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    const data = await fetchSemseDataForAuthenticatedRequest<Record<string, unknown>[]>(
      `/v1/organizations/${encodeURIComponent(orgId)}/invitations${qs}`,
      request
    );
    return NextResponse.json({ data }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: { status: 400, message: "Invalid email" } }, { status: 400 });
    }
    const data = await fetchSemseDataForAuthenticatedRequest<Record<string, unknown>>(
      `/v1/organizations/${encodeURIComponent(orgId)}/invitations`,
      request,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, role: "WORKER" })
      }
    );
    return NextResponse.json({ data }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return fail(error);
  }
}

