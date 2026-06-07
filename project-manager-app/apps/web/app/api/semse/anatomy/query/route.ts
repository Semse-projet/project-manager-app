import { NextRequest, NextResponse } from "next/server";
import type { AnatomyQuery } from "@semse/schemas";
import { anatomyQuerySchema } from "@semse/schemas";
import { fetchSemseData, handleServerError, runtimeDisabledResponse } from "../../_server";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = anatomyQuerySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            status: 400,
            message: "Invalid anatomy query payload",
            details: parsed.error.flatten()
          }
        },
        { status: 400 }
      );
    }

    const data = await fetchSemseData<AnatomyQuery & Record<string, unknown>>("/v1/anatomy/query", {
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

