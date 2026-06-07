import { NextRequest, NextResponse } from "next/server";
import { fetchSemseDataForRequest, handleServerError, runtimeDisabledResponse, buildSemseRequestHeaders, getServerConfig } from "../_server";

const API = process.env.SEMSE_API_BASE_URL ?? "http://localhost:4000";

/** Returns bids submitted by the current professional user.
 * Fetches their jobs that have bids and collects bid data per job. */
export async function GET(request: NextRequest) {
  try {
    const cfg = await getServerConfig(request);
    const headers = { "content-type": "application/json", ...buildSemseRequestHeaders(cfg) };

    // Fetch jobs the professional has interacted with (has bids)
    const jobsResp = await fetch(`${API}/v1/jobs?status=PUBLISHED`, { headers });
    if (!jobsResp.ok) return runtimeDisabledResponse();
    const jobsJson = await jobsResp.json() as { data: Array<{ id: string; title: string; category: string; status: string; budgetMin?: number; budgetMax?: number; location?: string }> };
    const jobs = jobsJson.data ?? [];

    // For each job, fetch bids to find current user's bids
    const bidResults: Array<{
      bidId: string; jobId: string; jobTitle: string; category: string;
      location?: string; budgetMin?: number; budgetMax?: number;
      status: string; note?: string; createdAt: string;
    }> = [];

    await Promise.all(
      jobs.slice(0, 20).map(async (job) => {
        try {
          const bidsResp = await fetch(`${API}/v1/jobs/${job.id}/bids`, { headers });
          if (!bidsResp.ok) return;
          const bidsJson = await bidsResp.json() as { data: Array<{ id: string; status: string; note?: string; createdAt: string; professionalUserId?: string }> };
          const bids = bidsJson.data ?? [];
          for (const bid of bids) {
            bidResults.push({
              bidId: bid.id, jobId: job.id, jobTitle: job.title,
              category: job.category, location: job.location,
              budgetMin: job.budgetMin, budgetMax: job.budgetMax,
              status: bid.status, note: bid.note, createdAt: bid.createdAt,
            });
          }
        } catch { /* skip job */ }
      })
    );

    bidResults.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return NextResponse.json({ data: { bids: bidResults, total: bidResults.length } });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) return runtimeDisabledResponse();
    return handleServerError(error);
  }
}
