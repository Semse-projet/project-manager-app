"use client";

import { useCallback, useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import { AdminPageHeader } from "../../../../components/admin/AdminPageHeader";
import { useLanguage } from "../../../../../lib/language-context";
import { Badge, Button, Card, ErrorState, Spinner, Textarea, statusVariant } from "../../../../../components/ui";
import {
  fetchAdminContributorAppeals,
  fetchAdminContributorSubmissions,
  reviewAdminContributorSubmission,
  resolveAdminContributorAppeal,
  type ContributorAppealView,
  type KnowledgeSubmissionView,
} from "../../../../semse-api";

function AppealPanel({ appeal, onDone }: { appeal: ContributorAppealView; onDone: () => void }) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function resolve(status: "UPHELD" | "OVERTURNED") {
    if (!reason.trim()) {
      setError(t("contributors.admin.reasonRequired"));
      return;
    }
    setBusy(status);
    setError(null);
    try {
      await resolveAdminContributorAppeal(appeal.id, { status, resolutionReason: reason.trim() });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <p className="text-sm font-semibold text-ink">{appeal.missionTitle ?? appeal.submissionId}</p>
      <p className="mt-1 text-xs text-muted">“{appeal.reason}”</p>
      <Textarea
        className="mt-3"
        label={t("contributors.review.reason")}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        rows={2}
      />
      {error ? <p className="mt-1 text-xs text-red-400">{error}</p> : null}
      <div className="mt-3 flex gap-2">
        <Button size="sm" loading={busy === "OVERTURNED"} onClick={() => resolve("OVERTURNED")}>
          {t("contributors.admin.appealOverturn")}
        </Button>
        <Button size="sm" variant="ghost" loading={busy === "UPHELD"} onClick={() => resolve("UPHELD")}>
          {t("contributors.admin.appealUphold")}
        </Button>
      </div>
    </Card>
  );
}

function ReviewPanel({ submission, onDone }: { submission: KnowledgeSubmissionView; onDone: () => void }) {
  const { t } = useLanguage();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "APPROVED" | "REJECTED" | "CHANGES_REQUESTED") {
    if (!reason.trim()) {
      setError(t("contributors.admin.reasonRequired"));
      return;
    }
    setBusy(decision);
    setError(null);
    try {
      await reviewAdminContributorSubmission(submission.id, { decision, reason: reason.trim() });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">{submission.missionTitle}</p>
          <p className="text-xs text-muted">
            {submission.assets.length} evidencia(s) ·{" "}
            {new Date(submission.submittedAt ?? submission.createdAt).toLocaleString()}
          </p>
        </div>
        <Badge variant={statusVariant(submission.status)}>{submission.status}</Badge>
      </div>

      {submission.notes ? <p className="mt-2 text-xs text-muted">“{submission.notes}”</p> : null}

      <ul className="mt-3 space-y-1 text-xs text-muted">
        {submission.assets.map((asset) => (
          <li key={asset.id}>
            · {asset.kind} — {asset.clipRole} ({asset.processingStatus})
          </li>
        ))}
      </ul>

      <Textarea
        className="mt-3"
        label={t("contributors.review.reason")}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        rows={2}
      />
      {error ? <p className="mt-1 text-xs text-red-400">{error}</p> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" loading={busy === "APPROVED"} onClick={() => decide("APPROVED")}>
          {t("contributors.admin.reviewApprove")}
        </Button>
        <Button size="sm" variant="ghost" loading={busy === "CHANGES_REQUESTED"} onClick={() => decide("CHANGES_REQUESTED")}>
          {t("contributors.admin.reviewChanges")}
        </Button>
        <Button size="sm" variant="destructive" loading={busy === "REJECTED"} onClick={() => decide("REJECTED")}>
          {t("contributors.admin.reviewReject")}
        </Button>
      </div>
    </Card>
  );
}

export default function AdminContributorSubmissionsPage() {
  const { t } = useLanguage();
  const [submissions, setSubmissions] = useState<KnowledgeSubmissionView[]>([]);
  const [appeals, setAppeals] = useState<ContributorAppealView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([fetchAdminContributorSubmissions(), fetchAdminContributorAppeals()])
      .then(([submissionRows, appealRows]) => {
        setSubmissions(submissionRows);
        setAppeals(appealRows);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "error"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="p-6">
      <AdminPageHeader
        title={t("contributors.admin.title")}
        subtitle={t("contributors.admin.submissions")}
        icon={ClipboardList}
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
        ) : submissions.length === 0 ? (
          <p className="text-sm text-muted">—</p>
        ) : (
          <div className="space-y-4">
            {submissions.map((submission) => (
              <ReviewPanel key={submission.id} submission={submission} onDone={load} />
            ))}
          </div>
        )}
      </div>

      {appeals.length > 0 ? (
        <div className="mt-10">
          <h2 className="text-sm font-bold text-ink">{t("contributors.admin.appealResolve")}</h2>
          <div className="mt-3 space-y-4">
            {appeals.map((appeal) => (
              <AppealPanel key={appeal.id} appeal={appeal} onDone={load} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
