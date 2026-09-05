import type { CreateMaterialRequestInput, MaterialRequestRecordView } from "@semse/schemas";
import { apiFetch } from "./client";

export async function fetchMyMaterialRequests(): Promise<MaterialRequestRecordView[]> {
  return apiFetch<MaterialRequestRecordView[]>("/v1/materials");
}

export async function createMaterialRequest(input: CreateMaterialRequestInput): Promise<MaterialRequestRecordView> {
  return apiFetch<MaterialRequestRecordView>("/v1/materials", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
