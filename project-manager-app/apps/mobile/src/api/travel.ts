import type { TravelAssignmentRecordView, TravelAssignmentSummaryView } from "@semse/schemas";
import { apiFetch } from "./client";

export async function fetchMyTravelAssignments(): Promise<TravelAssignmentSummaryView[]> {
  return apiFetch<TravelAssignmentSummaryView[]>("/v1/travel/summary");
}

export async function fetchTravelAssignmentDetail(travelId: string): Promise<TravelAssignmentRecordView> {
  return apiFetch<TravelAssignmentRecordView>(`/v1/travel/${encodeURIComponent(travelId)}`);
}
