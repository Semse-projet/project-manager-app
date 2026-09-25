import type { BidRecordView } from "@semse/schemas";
import { apiFetch } from "./client";

export type SubmitBidInput = {
  amount: number;
  etaDays: number;
  note?: string;
};

export async function fetchMyBids(): Promise<BidRecordView[]> {
  return apiFetch<BidRecordView[]>("/v1/my-bids");
}

export async function fetchJobBids(jobId: string): Promise<BidRecordView[]> {
  return apiFetch<BidRecordView[]>(`/v1/jobs/${encodeURIComponent(jobId)}/bids`);
}

export async function submitBid(jobId: string, input: SubmitBidInput): Promise<BidRecordView> {
  return apiFetch<BidRecordView>(`/v1/jobs/${encodeURIComponent(jobId)}/bids`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function acceptBid(bidId: string): Promise<BidRecordView> {
  return apiFetch<BidRecordView>(`/v1/bids/${encodeURIComponent(bidId)}/accept`, {
    method: "POST",
  });
}
