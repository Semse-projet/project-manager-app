import { type NextRequest, NextResponse } from "next/server";
import { decodeSession, SESSION_COOKIE } from "../../../../lib/auth";

export async function requireCommunicationsSession(request: NextRequest): Promise<NextResponse | null> {
  const proxiedUserId = request.headers.get("x-semse-user-id")?.trim();
  if (proxiedUserId) {
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
        message: "Authentication required for communications.",
      },
    },
    { status: 401 },
  );
}
