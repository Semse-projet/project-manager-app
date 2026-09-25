import type { RatingRecordView } from "@semse/schemas";
import { apiFetch } from "./client";

export type SubmitRatingInput = {
  jobId: string;
  toUserId: string;
  score: number;
  comment?: string;
};

/** Scoped server-side to ratings where the actor is fromUserId or toUserId (RatingsService.listRatings) — no jobId filter param exists, filter client-side. */
export async function fetchMyRatings(): Promise<RatingRecordView[]> {
  return apiFetch<RatingRecordView[]>("/v1/ratings");
}

export async function submitRating(input: SubmitRatingInput): Promise<RatingRecordView> {
  return apiFetch<RatingRecordView>("/v1/ratings", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
