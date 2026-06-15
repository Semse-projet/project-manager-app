import { NextRequest, NextResponse } from "next/server";
import { SEMSE_PROXY_HEADER_NAMES } from "@semse/shared";
import { decodeSession, SESSION_COOKIE } from "../../../../lib/auth";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../_server";

type RatingUser = {
  id: string;
  email: string;
};

type RatingJob = {
  id: string;
  title: string;
};

type RatingRecord = {
  id: string;
  jobId: string;
  score: number;
  comment?: string;
  createdAt: string | Date;
  job: RatingJob;
  fromUser: RatingUser;
  toUser: RatingUser;
};

async function resolveActorUserId(request: NextRequest): Promise<string | null> {
  const fromHeader = request.headers.get(SEMSE_PROXY_HEADER_NAMES.userId)?.trim();
  if (fromHeader) return fromHeader;

  const encoded = request.cookies.get(SESSION_COOKIE)?.value;
  if (!encoded) return null;

  const session = await decodeSession(encoded);
  return session?.userId ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const items = await fetchSemseDataForRequest<RatingRecord[]>("/v1/ratings", request);
    const actorUserId = await resolveActorUserId(request);
    return NextResponse.json({ data: { actorUserId, items } });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) {
      return runtimeDisabledResponse();
    }

    return handleServerError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const data = await fetchSemseDataForRequest<RatingRecord>(
      "/v1/ratings",
      request,
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }
    );
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) {
      return runtimeDisabledResponse();
    }
    return handleServerError(error);
  }
}
