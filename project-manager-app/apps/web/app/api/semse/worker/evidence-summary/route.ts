import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse } from "../../_server";

/** Returns count of missing/rejected evidence items across the worker's active jobs. */
export async function GET(request: NextRequest) {
  try {
    // Fetch worker's active jobs
    const jobsData = await fetchSemseDataForRequest<{ jobs: Array<{ id: string }> }>("/v1/jobs?status=ACCEPTED,IN_PROGRESS,RESERVED", request);
    const jobs = (jobsData as { jobs?: unknown[] }).jobs ?? (Array.isArray(jobsData) ? jobsData : []);

    // Count missing/rejected evidence across these jobs
    let missingCount = 0;
    let totalCount   = 0;

    await Promise.all(
      (jobs as Array<{ id: string }>).slice(0, 10).map(async (job) => {
        try {
          const ev = await fetchSemseDataForRequest<unknown[]>(`/v1/jobs/${job.id}/evidence`, request);
          const items = Array.isArray(ev) ? ev : [];
          totalCount   += items.length;
          missingCount += items.filter((i) => {
            const item = i as Record<string, unknown>;
            return item.status === "missing" || item.status === "rejected";
          }).length;
        } catch { /* skip */ }
      })
    );

    return NextResponse.json({ data: { missingCount, totalCount } });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) return runtimeDisabledResponse();
    return handleServerError(error);
  }
}
