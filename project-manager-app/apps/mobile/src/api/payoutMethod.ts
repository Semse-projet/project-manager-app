import type { SaveWorkerPayoutMethodInput, WorkerPayoutMethodView } from "@semse/schemas";
import { apiFetch } from "./client";

export async function fetchPayoutMethod(): Promise<WorkerPayoutMethodView | null> {
  return apiFetch<WorkerPayoutMethodView | null>("/v1/workers/me/payout-method");
}

export async function savePayoutMethod(input: SaveWorkerPayoutMethodInput): Promise<WorkerPayoutMethodView> {
  return apiFetch<WorkerPayoutMethodView>("/v1/workers/me/payout-method", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
