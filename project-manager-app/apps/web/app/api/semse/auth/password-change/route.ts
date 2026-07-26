import { type NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError } from "../../_server";

type PasswordChangeResult = {
  status: "updated";
  userId: string;
  revokedOtherSessions: number;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const data = await fetchSemseDataForRequest<PasswordChangeResult>(
      "/v1/auth/password-change",
      request,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}
