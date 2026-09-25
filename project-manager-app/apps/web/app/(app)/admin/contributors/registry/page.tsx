"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import { AdminPageHeader } from "../../../../components/admin/AdminPageHeader";
import { useLanguage } from "../../../../../lib/language-context";
import { Badge, Button, Card, EmptyState, ErrorState, Input, Spinner } from "../../../../../components/ui";
import {
  listAdminContributorKnowledgeRegistry,
  type KnowledgeRegistryEntryView,
} from "../../../../semse-api";

const PAGE_SIZE = 20;

type Filters = { trade: string; category: string; search: string };
const emptyFilters: Filters = { trade: "", category: "", search: "" };

export default function AdminKnowledgeRegistryPage() {
  const { t } = useLanguage();
  const [items, setItems] = useState<KnowledgeRegistryEntryView[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  // draftFilters bind the inputs; appliedFilters only change on "Buscar" /
  // "Limpiar filtros" — this is what load() fetches by, so typing never
  // fires a request per keystroke.
  const [draftFilters, setDraftFilters] = useState<Filters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listAdminContributorKnowledgeRegistry({
      trade: appliedFilters.trade.trim() || undefined,
      category: appliedFilters.category.trim() || undefined,
      search: appliedFilters.search.trim() || undefined,
      page,
      pageSize: PAGE_SIZE,
    })
      .then((result) => {
        setItems(result.items);
        setTotal(result.total);
        setHasMore(result.hasMore);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "error"))
      .finally(() => setLoading(false));
  }, [appliedFilters, page]);

  useEffect(() => {
    load();
  }, [load]);

  function applyFilters() {
    setPage(1);
    setAppliedFilters(draftFilters);
  }

  function clearFilters() {
    setDraftFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(1);
  }

  return (
    <div className="p-6">
      <AdminPageHeader
        title={t("contributors.admin.registry.title")}
        subtitle={t("contributors.admin.registry.subtitle")}
        icon={BookOpen}
        backHref="/admin/contributors"
      />

      <Card className="mt-4 grid gap-3 sm:grid-cols-4">
        <Input
          label={t("contributors.admin.registry.filterTrade")}
          value={draftFilters.trade}
          onChange={(e) => setDraftFilters((prev) => ({ ...prev, trade: e.target.value }))}
        />
        <Input
          label={t("contributors.admin.registry.filterCategory")}
          value={draftFilters.category}
          onChange={(e) => setDraftFilters((prev) => ({ ...prev, category: e.target.value }))}
        />
        <Input
          label={t("contributors.admin.registry.search")}
          value={draftFilters.search}
          onChange={(e) => setDraftFilters((prev) => ({ ...prev, search: e.target.value }))}
        />
        <div className="flex items-end gap-2">
          <Button size="sm" onClick={applyFilters}>
            {t("contributors.admin.registry.filterApply")}
          </Button>
          <Button size="sm" variant="ghost" onClick={clearFilters}>
            {t("contributors.admin.registry.clearFilters")}
          </Button>
        </div>
      </Card>

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
        ) : items.length === 0 ? (
          <EmptyState
            title={t("contributors.admin.registry.empty.title")}
            description={t("contributors.admin.registry.empty.description")}
          />
        ) : (
          <>
            <div className="space-y-3">
              {items.map((entry) => (
                <Card key={entry.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-ink">{entry.missionTitle}</p>
                      <p className="text-xs text-muted">
                        {entry.trade} · {entry.category}
                      </p>
                    </div>
                    <Badge variant="success">{entry.promotionStatus}</Badge>
                  </div>
                  <dl className="mt-3 grid gap-2 text-xs text-ink sm:grid-cols-2">
                    {(["objective", "condition", "decision", "reason", "method", "action", "result"] as const)
                      .filter((field) => entry[field])
                      .map((field) => (
                        <div key={field}>
                          <dt className="text-muted">{field}</dt>
                          <dd>{entry[field]}</dd>
                        </div>
                      ))}
                  </dl>
                  <p className="mt-3 text-xs text-muted">
                    {t("contributors.admin.registry.promotedBy")} {entry.promotedByUserId}{" "}
                    {t("contributors.admin.registry.promotedAt")}{" "}
                    {entry.promotedAt ? new Date(entry.promotedAt).toLocaleString() : ""}
                  </p>
                </Card>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between text-xs text-muted">
              <span>
                {total} {t("contributors.admin.registry.results")}
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  {t("contributors.admin.registry.prev")}
                </Button>
                <Button size="sm" variant="ghost" disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>
                  {t("contributors.admin.registry.next")}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
