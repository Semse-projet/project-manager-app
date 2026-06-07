import { NextRequest, NextResponse } from "next/server";
import { releaseEscrowSchema } from "@semse/schemas";
import {
  fetchSemseDataForRequest,
  handleServerError,
  runtimeDisabledResponse
} from "../../../_server";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ milestoneId: string }> }
) {
  try {
    const { milestoneId } = await context.params;
    const rawBody = (await request.text()).trim();
    const body = rawBody.length > 0 ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
    const parsed = releaseEscrowSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            status: 400,
            message: "Invalid milestone release payload",
            details: parsed.error.flatten()
          }
        },
        { status: 400 }
      );
    }

    const data = await fetchSemseDataForRequest<Record<string, unknown>>(
      `/v1/milestones/${milestoneId}/escrow/release`,
      request,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(parsed.data)
      }
    );

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) {
      return runtimeDisabledResponse();
    }

    return handleServerError(error);
  }
}
