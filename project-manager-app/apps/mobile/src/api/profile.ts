import type { ProximityCheckInMode, UserProfileView } from "@semse/schemas";
import { apiFetch } from "./client";

export type { ProximityCheckInMode };
export type UserProfile = UserProfileView;

export async function fetchProfile(): Promise<UserProfile> {
  return apiFetch<UserProfile>("/v1/users/me/profile");
}

export async function updateProximityCheckInMode(mode: ProximityCheckInMode): Promise<UserProfile> {
  return apiFetch<UserProfile>("/v1/users/me/profile", {
    method: "PATCH",
    body: JSON.stringify({ proximityCheckInMode: mode }),
  });
}
