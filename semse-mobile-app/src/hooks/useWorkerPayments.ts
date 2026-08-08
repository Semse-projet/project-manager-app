import { useEffect, useState } from "react";
import { payments as mockPayments } from "@/data/mockData";
import { listWorkerJobs } from "@/domains/worker/jobs/repository";
import { mobileFetchContract, SEMSE_CONTRACTS } from "@/lib/api/contracts";
import { MOBILE_ENV } from "@/lib/config/env";
import { MobileApiError } from "@/lib/api/http";
import { trackTelemetryEvent } from "@/lib/observability/telemetry";

export type WorkerPayment = {
  id: string;
  description: string;
  amount: number;
  date: string;
  status: "released" | "in_escrow" | "pending";
  jobId?: string;
  jobTitle?: string;
  disputed?: boolean;
};

export type WorkerPayoutMethod = {
  type: "bank_account" | "debit_card" | "paypal" | "zelle" | "cashapp";
  label: string;
  bankName?: string;
  last4?: string;
  email?: string;
  verified?: boolean;
};

type WorkerPaymentsPayload = {
  payments: WorkerPayment[];
  payoutMethod: WorkerPayoutMethod | null;
  disputedJobIds: string[];
  jobs: { id: string; title: string }[];
};

function formatDate(value: unknown): string {
  if (typeof value !== "string") {
    return "Sin fecha";
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }

  return new Date(parsed).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function mapRawPayment(
  record: Record<string, unknown>,
  jobId: string,
  jobTitle: string,
): WorkerPayment {
  const type = typeof record.type === "string" ? record.type : "UNKNOWN";
  return {
    id: typeof record.id === "string" ? record.id : `pay_${jobId}`,
    description:
      typeof record.description === "string"
        ? record.description
        : `${jobTitle} - ${type === "RELEASE" ? "Liberacion" : type === "DEPOSIT" ? "Escrow" : "Movimiento"}`,
    amount: typeof record.amount === "number" ? record.amount : Number(record.amount ?? 0),
    date: formatDate(record.createdAt ?? record.updatedAt),
    status: type === "RELEASE" ? "released" : type === "DEPOSIT" ? "in_escrow" : "pending",
    jobId,
    jobTitle,
  };
}

function mockWorkerPaymentsPayload(): WorkerPaymentsPayload {
  return {
    payments: mockPayments.map((payment) => ({
      ...payment,
      status: payment.status === "completed" ? "released" : "pending",
    })),
    payoutMethod: null,
    disputedJobIds: [],
    jobs: [],
  };
}

async function fetchDisputedJobIds(): Promise<string[]> {
  return mobileFetchContract<Record<string, unknown>[]>(SEMSE_CONTRACTS.disputes.list)
    .then((rows) =>
      rows
        .map((row) => (typeof row.jobId === "string" ? row.jobId : ""))
        .filter(Boolean),
    )
    .catch(() => []);
}

async function fetchPayoutMethod(): Promise<WorkerPayoutMethod | null> {
  return mobileFetchContract<Record<string, unknown> | null>(SEMSE_CONTRACTS.workers.payoutMethod)
    .then((row) => {
      if (!row) {
        return null;
      }

      const type = typeof row.type === "string" ? row.type : null;
      const label = typeof row.label === "string" ? row.label : null;
      if (!type || !label) {
        return null;
      }

      return {
        type: type as WorkerPayoutMethod["type"],
        label,
        bankName: typeof row.bankName === "string" ? row.bankName : undefined,
        last4: typeof row.last4 === "string" ? row.last4 : undefined,
        email: typeof row.email === "string" ? row.email : undefined,
        verified: Boolean(row.verified),
      };
    })
    .catch(() => null);
}

export function useWorkerPayments(): {
  payments: WorkerPayment[];
  loading: boolean;
  payoutMethod: WorkerPayoutMethod | null;
  disputedJobIds: string[];
  jobs: { id: string; title: string }[];
  savePayoutMethod: (payload: Omit<WorkerPayoutMethod, "verified">) => Promise<void>;
  savingPayoutMethod: boolean;
} {
  const [payments, setPayments] = useState<WorkerPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [payoutMethod, setPayoutMethod] = useState<WorkerPayoutMethod | null>(null);
  const [disputedJobIds, setDisputedJobIds] = useState<string[]>([]);
  const [jobs, setJobs] = useState<{ id: string; title: string }[]>([]);
  const [savingPayoutMethod, setSavingPayoutMethod] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      const payload = MOBILE_ENV.runtimeMode === "mock"
        ? mockWorkerPaymentsPayload()
        : await listWorkerJobs()
            .then(async (workerJobs) => {
              const [payoutMethod, disputedJobIds] = await Promise.all([
                fetchPayoutMethod(),
                fetchDisputedJobIds(),
              ]);

              const paymentGroups = await Promise.all(
                workerJobs.map((job) =>
                  mobileFetchContract<Record<string, unknown>[]>(SEMSE_CONTRACTS.jobs.payments(job.id))
                    .then((rows) => rows.map((row) => mapRawPayment(row, job.id, job.title)))
                    .catch((error: unknown) => {
                      if (error instanceof MobileApiError && error.status === 404) {
                        return [];
                      }
                      return [];
                    }),
                ),
              );

              return {
                payments: paymentGroups.flat(),
                payoutMethod,
                disputedJobIds,
                jobs: workerJobs.map((job) => ({ id: job.id, title: job.title })),
              };
            })
            .catch(() => {
              if (MOBILE_ENV.allowMockFallback) {
                return mockWorkerPaymentsPayload();
              }
              throw new Error("worker.payments contract fetch failed");
            });

      if (cancelled) {
        return;
      }

      const nextPayments = payload.payments.map((payment) => ({
        ...payment,
        disputed: payment.jobId ? payload.disputedJobIds.includes(payment.jobId) : false,
      }));

      trackTelemetryEvent({
        name: "worker.payments.loaded",
        surface: "worker.payments",
        metadata: { total: nextPayments.length, mode: MOBILE_ENV.runtimeMode },
      });

      setPayments(nextPayments);
      setPayoutMethod(payload.payoutMethod);
      setDisputedJobIds(payload.disputedJobIds);
      setJobs(payload.jobs);
      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  async function savePayoutMethod(payload: Omit<WorkerPayoutMethod, "verified">): Promise<void> {
    setSavingPayoutMethod(true);
    try {
      await mobileFetchContract<Record<string, unknown>>(SEMSE_CONTRACTS.workers.payoutMethod, {
        method: "POST",
        body: payload,
      });
      setPayoutMethod({ ...payload, verified: false });
    } finally {
      setSavingPayoutMethod(false);
    }
  }

  return { payments, loading, payoutMethod, disputedJobIds, jobs, savePayoutMethod, savingPayoutMethod };
}
