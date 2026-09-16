"use client";

import { useCallback, useEffect, useState } from "react";
import { HandCoins } from "lucide-react";
import { AdminPageHeader } from "../../../../components/admin/AdminPageHeader";
import { useLanguage } from "../../../../../lib/language-context";
import { Badge, Button, Card, ErrorState, Spinner, statusVariant } from "../../../../../components/ui";
import {
  authorizeAdminContributorRewardPayout,
  fetchAdminContributorRewards,
  type ContributorRewardView,
} from "../../../../semse-api";

function formatCents(cents: number, currency: string): string {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency, maximumFractionDigits: 2 }).format(cents / 100);
}

export default function AdminContributorRewardsPage() {
  const { t } = useLanguage();
  const [rewards, setRewards] = useState<ContributorRewardView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchAdminContributorRewards()
      .then(setRewards)
      .catch((err) => setError(err instanceof Error ? err.message : "error"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAuthorize(id: string) {
    setBusyId(id);
    try {
      await authorizeAdminContributorRewardPayout(id);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="p-6">
      <AdminPageHeader
        title={t("contributors.admin.title")}
        subtitle={t("contributors.admin.rewards")}
        icon={HandCoins}
        backHref="/admin/contributors"
      />

      {error ? (
        <div className="mt-4">
          <ErrorState message={error} onRetry={load} />
        </div>
      ) : null}

      <div className="mt-6">
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <div className="space-y-3">
            {rewards.map((reward) => (
              <Card key={reward.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">{reward.missionTitle ?? reward.submissionId}</p>
                  <p className="text-xs text-muted">
                    {formatCents(reward.amountCents, reward.currency)} · {reward.userId}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusVariant(reward.status)}>{reward.status}</Badge>
                  {reward.status !== "PAID" ? (
                    <Button size="sm" loading={busyId === reward.id} onClick={() => handleAuthorize(reward.id)}>
                      {t("contributors.admin.authorizePayout")}
                    </Button>
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
