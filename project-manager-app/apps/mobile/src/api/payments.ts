import type { PaymentTxnRecordView } from "@semse/schemas";
import { apiFetch } from "./client";

/** No single "my payments" endpoint exists — fetch per job and flatten, same convention as apps/web's worker/payments page. */
export async function fetchJobPayments(jobId: string): Promise<PaymentTxnRecordView[]> {
  return apiFetch<PaymentTxnRecordView[]>(`/v1/jobs/${encodeURIComponent(jobId)}/payments`);
}
