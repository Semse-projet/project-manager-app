import { NextRequest, NextResponse } from "next/server";
import { registerEvidenceSchema } from "@semse/schemas";
import {
  fetchSemseDataForRequest,
  handleServerError,
  runtimeDisabledResponse
} from "../../../_server";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await context.params;
    const data = await fetchSemseDataForRequest<Record<string, unknown>[]>(
      `/v1/jobs/${jobId}/evidence`,
      request
    );
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) {
      return runtimeDisabledResponse();
    }

    return handleServerError(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const parsed = registerEvidenceSchema.safeParse({ ...body, jobId });
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            status: 400,
            message: "Invalid evidence payload",
            details: parsed.error.flatten()
          }
        },
        { status: 400 }
      );
    }

    const data = await fetchSemseDataForRequest<Record<string, unknown>>(`/v1/evidence`, request, {
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
