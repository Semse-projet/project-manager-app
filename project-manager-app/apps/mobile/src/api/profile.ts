import { apiFetch } from "./client";

export type ProximityCheckInMode = "ask" | "auto" | "off";

export type UserProfile = {
  userId: string;
  proximityCheckInMode: ProximityCheckInMode;
};

export async function fetchProfile(): Promise<UserProfile> {
  return apiFetch<UserProfile>("/v1/users/me/profile");
}

export async function updateProximityCheckInMode(mode: ProximityCheckInMode): Promise<UserProfile> {
  return apiFetch<UserProfile>("/v1/users/me/profile", {
    method: "PATCH",
    body: JSON.stringify({ proximityCheckInMode: mode }),
  });
}
