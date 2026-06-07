import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError } from "../../../../_server";
import { decodeSession, SESSION_COOKIE } from "../../../../../../../lib/auth";

export const dynamic = "force-dynamic";

async function requireSession(request: NextRequest): Promise<NextResponse | null> {
  if (request.headers.get("x-semse-user-id")?.trim()) {
    return null;
  }

  const encoded = request.cookies.get(SESSION_COOKIE)?.value;
  const session = encoded ? await decodeSession(encoded) : null;
  if (session) {
    return null;
  }

  return NextResponse.json(
    {
      error: {
        status: 401,
        message: "Authentication required for Prometeo feedback.",
      },
    },
    { status: 401 },
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ chunkId: string }> },
) {
  try {
    const authError = await requireSession(request);
    if (authError) return authError;

    const { chunkId } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const data = await fetchSemseDataForRequest(
      `/v1/prometeo/chunks/${encodeURIComponent(chunkId)}/feedback`,
      request,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
    );
    return NextResponse.json({ data });
  } catch (e) { return handleServerError(e); }
}
