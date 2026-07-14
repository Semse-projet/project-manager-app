import { NextRequest, NextResponse } from "next/server";
import { handleServerError, runtimeDisabledResponse, buildAuthorizedHeaders, getServerConfig } from "../_server";

const API = process.env.SEMSE_API_BASE_URL ?? "http://localhost:4000";

type MyBid = {
  id: string;
  jobId: string;
  jobTitle?: string;
  jobCategory?: string;
  jobLocation?: string;
  jobBudgetMin?: number;
  jobBudgetMax?: number;
  jobStatus?: string;
  amount: number;
  etaDays: number;
  status: string;
  note?: string;
  createdAt?: string;
};

function toClientBid(bid: MyBid) {
  return {
    id: bid.id,
    jobId: bid.jobId,
    jobTitle: bid.jobTitle ?? bid.jobId,
    jobCategory: bid.jobCategory,
    jobLocation: bid.jobLocation,
    jobBudgetMin: bid.jobBudgetMin,
    jobBudgetMax: bid.jobBudgetMax,
    jobStatus: bid.jobStatus ?? "accepted",
    amount: bid.amount,
    etaDays: bid.etaDays,
    status: bid.status,
    note: bid.note,
    createdAt: bid.createdAt ?? new Date(0).toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    const cfg = await getServerConfig(request);
    const headers = { "content-type": "application/json", ...(await buildAuthorizedHeaders(cfg)) };
    const response = await fetch(`${API}/v1/my-bids`, { headers });
    if (!response.ok) return runtimeDisabledResponse();
    const payload = await response.json() as { data?: MyBid[] };
    const bidResults = (payload.data ?? []).map(toClientBid);
    bidResults.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ data: { bids: bidResults, total: bidResults.length } });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) return runtimeDisabledResponse();
    return handleServerError(error);
  }
}
