import { useEffect, useState } from "react";
import { getWorkerProfile } from "@/domains/worker/profile/repository";
import { listWorkerJobs } from "@/domains/worker/jobs/repository";
import { listWorkerDisputes } from "@/domains/worker/disputes/repository";
import { mobileFetchContract, SEMSE_CONTRACTS } from "@/lib/api/contracts";
import type { WorkerProfile } from "@/domains/worker/profile/types";

export type WorkerRating = {
  id: string;
  score: number;
  comment: string | null;
  createdAt: string;
  jobTitle: string;
};

export type WorkerProfileFull = WorkerProfile & {
  ratings: WorkerRating[];
  avgRating: number;
  completedJobsCount: number;
  openDisputesCount: number;
};

function formatDate(value: unknown): string {
  if (typeof value !== "string") return "Sin fecha";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Date(parsed).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

async function fetchRatings(): Promise<WorkerRating[]> {
  return mobileFetchContract<{ actorUserId: string | null; items: Record<string, unknown>[] }>(SEMSE_CONTRACTS.ratings.list)
    .then((payload) =>
      payload.items.map((item) => ({
        id: typeof item.id === "string" ? item.id : "rating_unknown",
        score: typeof item.score === "number" ? item.score : 0,
        comment: typeof item.comment === "string" ? item.comment : null,
        createdAt: formatDate(item.createdAt),
        jobTitle: typeof (item.job as Record<string, unknown>)?.title === "string"
          ? (item.job as Record<string, unknown>).title as string
          : "Trabajo",
      })),
    )
    .catch(() => []);
}

export function useWorkerProfile(): { profile: WorkerProfileFull | null; loading: boolean } {
  const [profile, setProfile] = useState<WorkerProfileFull | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      const [base, ratings, jobs, disputes] = await Promise.all([
        getWorkerProfile(),
        fetchRatings(),
        listWorkerJobs().catch(() => []),
        listWorkerDisputes().catch(() => []),
      ]);

      if (cancelled) return;

      const completedJobsCount = jobs.filter((job) => job.status === "completed").length;
      const openDisputesCount = disputes.filter((dispute) => {
        const row = dispute as unknown as Record<string, unknown>;
        return String(row.status ?? "").toUpperCase() === "OPEN";
      }).length;

      const avgRating = ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length
        : base?.rating ?? 0;

      setProfile(
        base
          ? {
              ...base,
              ratings,
              avgRating,
              completedJobsCount,
              openDisputesCount,
            }
          : null,
      );
      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return { profile, loading };
}
