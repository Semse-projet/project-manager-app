import type { UserRecordView } from "@semse/schemas";
import { apiFetch } from "./client";

/** OPS_ADMIN only (users:read) — tenant-wide user directory, read-only. */
export async function fetchUsers(): Promise<UserRecordView[]> {
  return apiFetch<UserRecordView[]>("/v1/users");
}
