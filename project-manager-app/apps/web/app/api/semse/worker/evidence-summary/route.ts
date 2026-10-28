import { NextRequest, NextResponse } from "next/server";
import { computeWorkerEvidenceSummary } from "@/lib/worker-evidence-summary";
import {
  fetchSemseDataForAuthenticatedRequest,
  handleServerError,
  isApiBaseConfigured,
  runtimeDisabledResponse,
} from "../../_server";

export const dynamic = "force-dynamic";

/** Returns the count of required milestone evidence the worker still has to upload on their active jobs. */
export async function GET(request: NextRequest) {
  if (!isApiBaseConfigured()) return runtimeDisabledResponse();
  try {
    const data = await computeWorkerEvidenceSummary(
      <T,>(path: string) => fetchSemseDataForAuthenticatedRequest<T>(path, request),
    );
    return NextResponse.json({ data });
  } catch (error) {
    return handleServerError(error);
  }
}
