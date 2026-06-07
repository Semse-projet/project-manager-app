import { NextResponse } from "next/server";
import type { RepoQuery } from "@semse/schemas";
import { repoQuerySchema } from "@semse/schemas";
import { fetchSemseData, handleServerError, runtimeDisabledResponse } from "../../_server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = repoQuerySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            status: 400,
            message: "Invalid repo knowledge query payload",
            details: parsed.error.flatten()
          }
        },
        { status: 400 }
      );
    }

    const data = await fetchSemseData<RepoQuery & Record<string, unknown>>("/v1/repo-knowledge/query", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(parsed.data)
    });

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) {
      return runtimeDisabledResponse();
    }

    return handleServerError(error);
  }
}
