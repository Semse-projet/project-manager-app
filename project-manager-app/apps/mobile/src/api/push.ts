import type { RegisterPushTokenInput } from "@semse/schemas";
import { apiFetch } from "./client";

export async function registerPushToken(input: RegisterPushTokenInput): Promise<void> {
  await apiFetch<{ id: string }>("/v1/push/register", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function unregisterPushToken(deviceId: string): Promise<void> {
  await apiFetch<{ deviceId: string; revoked: boolean }>(
    `/v1/push/register/${encodeURIComponent(deviceId)}`,
    { method: "DELETE" },
  );
}
