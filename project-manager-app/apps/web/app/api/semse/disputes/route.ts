import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../_server";

export async function GET(request: NextRequest) {
  try {
    const data = await fetchSemseDataForRequest<Record<string, unknown>[]>('/v1/disputes', request);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not configured')) {
      return runtimeDisabledResponse();
    }
    return handleServerError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : '';
    const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';

    if (reason.length < 5 || (!jobId && !projectId)) {
      return NextResponse.json(
        {
          error: {
            status: 400,
            message: 'Invalid dispute payload',
            details: {
              reason: 'reason must have at least 5 characters',
              scope: 'jobId or projectId is required'
            }
          }
        },
        { status: 400 }
      );
    }

    const data = await fetchSemseDataForRequest<Record<string, unknown>>('/v1/disputes', request, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...(jobId ? { jobId } : {}),
        ...(projectId ? { projectId } : {}),
        reason
      })
    });

    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not configured')) {
      return runtimeDisabledResponse();
    }
    return handleServerError(error);
  }
}
