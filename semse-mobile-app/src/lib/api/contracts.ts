import { MOBILE_ENV } from "@/lib/config/env";
import { mobileFetch, type HttpMethod } from "@/lib/api/http";

export type MobileApiContract = {
  bffPath: string;
  apiPath?: string;
  method?: HttpMethod;
};

export const SEMSE_CONTRACTS = {
  disputes: {
    list: { bffPath: "/disputes", apiPath: "/v1/disputes" },
  },
  ratings: {
    list: { bffPath: "/ratings", apiPath: "/v1/ratings" },
  },
  jobs: {
    list: { bffPath: "/jobs", apiPath: "/v1/jobs" },
    detail: (jobId: string): MobileApiContract => ({
      bffPath: `/jobs/${encodeURIComponent(jobId)}`,
      apiPath: `/v1/jobs/${encodeURIComponent(jobId)}`,
    }),
    payments: (jobId: string): MobileApiContract => ({
      bffPath: `/jobs/${encodeURIComponent(jobId)}/payments`,
      apiPath: `/v1/jobs/${encodeURIComponent(jobId)}/payments`,
    }),
  },
  travel: {
    list: { bffPath: "/travel", apiPath: "/v1/travel" },
    detail: (travelId: string): MobileApiContract => ({
      bffPath: `/travel/${encodeURIComponent(travelId)}`,
      apiPath: `/v1/travel/${encodeURIComponent(travelId)}`,
    }),
    expenses: (travelId: string): MobileApiContract => ({
      bffPath: `/travel/${encodeURIComponent(travelId)}/expenses`,
      apiPath: `/v1/travel/${encodeURIComponent(travelId)}/expenses`,
    }),
    lodging: (travelId: string): MobileApiContract => ({
      bffPath: `/travel/${encodeURIComponent(travelId)}/lodging`,
      apiPath: `/v1/travel/${encodeURIComponent(travelId)}/lodging`,
    }),
    advances: (travelId: string): MobileApiContract => ({
      bffPath: `/travel/${encodeURIComponent(travelId)}/advances`,
      apiPath: `/v1/travel/${encodeURIComponent(travelId)}/advances`,
    }),
  },
  workers: {
    payoutMethod: { bffPath: "/workers/payout-method", apiPath: "/v1/workers/me/payout-method" },
  },
  users: {
    me: { bffPath: "/users/me" },
  },
} as const;

export function resolveContractRequest(contract: MobileApiContract): {
  path: string;
  useBff: boolean;
  method?: HttpMethod;
} {
  if (MOBILE_ENV.runtimeMode === "api-direct" && contract.apiPath) {
    return {
      path: contract.apiPath,
      useBff: false,
      method: contract.method,
    };
  }

  return {
    path: contract.bffPath,
    useBff: true,
    method: contract.method,
  };
}

export async function mobileFetchContract<T>(
  contract: MobileApiContract,
  init?: {
    method?: HttpMethod;
    body?: unknown;
    headers?: Record<string, string>;
  },
): Promise<T> {
  const resolved = resolveContractRequest(contract);
  return mobileFetch<T>({
    path: resolved.path,
    useBff: resolved.useBff,
    method: init?.method ?? resolved.method,
    body: init?.body,
    headers: init?.headers,
  });
}
