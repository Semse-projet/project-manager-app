"use client";

import { useCallback, useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import { AdminPageHeader } from "../../../../components/admin/AdminPageHeader";
import { useLanguage } from "../../../../../lib/language-context";
import { Badge, Button, Card, ErrorState, Spinner, Textarea, statusVariant } from "../../../../../components/ui";
import {
  fetchAdminContributorAppeals,
  fetchAdminContributorSubmissions,
  fetchAdminContributorExtractions,
  correctAdminContributorObservation,
  promoteAdminContributorObservation,
  rejectAdminContributorObservationPromotion,
  reviewAdminContributorSubmission,
  resolveAdminContributorAppeal,
  type ContributorAppealView,
  type KnowledgeSubmissionView,
  type KnowledgeExtractionView,
  type ObservationView,
} from "../../../../semse-api";

const OBSERVATION_FIELD_NAMES = ["objective", "condition", "decision", "reason", "method", "action", "result"] as const;
type ObservationFieldName = (typeof OBSERVATION_FIELD_NAMES)[number];

function extractionStatusVariant(status: string): "default" | "success" | "info" | "warn" | "error" {
  switch (status) {
    case "COMPLETED":
      return "success";
    case "PROCESSING":
      return "info";
    case "PENDING":
      return "warn";
    case "FAILED":
      return "error";
    default:
      return "default";
  }
}

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function ObservationCorrectionForm({
  observation,
  onDone,
  onCancel,
}: {
  observation: ObservationView;
  onDone: () => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const [values, setValues] = useState<Record<ObservationFieldName, string>>(() => {
    const initial = {} as Record<ObservationFieldName, string>;
    for (const field of OBSERVATION_FIELD_NAMES) {
      initial[field] = observation[field] ?? "";
    }
    return initial;
  });
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!reason.trim()) {
      setError(t("contributors.admin.reasonRequired"));
      return;
    }
    const correctedFields: Record<string, string> = {};
    for (const field of OBSERVATION_FIELD_NAMES) {
      const nextValue = values[field].trim();
      const originalValue = observation[field] ?? "";
      if (nextValue && nextValue !== originalValue) {
        correctedFields[field] = nextValue;
      }
    }
    if (Object.keys(correctedFields).length === 0) {
      setError(t("contributors.admin.reasonRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await correctAdminContributorObservation(observation.id, { correctedFields, reason: reason.trim() });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 rounded border border-white/10 bg-white/[0.03] p-3">
      {OBSERVATION_FIELD_NAMES.map((field) => (
        <Textarea
          key={field}
          className="mt-2"
          label={field.toUpperCase()}
          value={values[field]}
          onChange={(event) => setValues((prev) => ({ ...prev, [field]: event.target.value }))}
          rows={2}
        />
      ))}
      <Textarea
        className="mt-2"
        label={t("contributors.admin.extractions.correctionReason")}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        rows={2}
      />
      {error ? <p className="mt-1 text-xs text-red-400">{error}</p> : null}
      <div className="mt-2 flex gap-2">
        <Button size="sm" loading={busy} onClick={submit}>
          {t("contributors.admin.extractions.correctionSubmit")}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          {t("contributors.admin.extractions.correctionCancel")}
        </Button>
      </div>
    </div>
  );
}

function promotionStatusVariant(status: ObservationView["promotionStatus"]): "default" | "success" | "error" {
  if (status === "PROMOTED") return "success";
  if (status === "REJECTED") return "error";
  return "default";
}

function PromotionReasonPrompt({
  label,
  onSubmit,
  onCancel,
}: {
  label: string;
  onSubmit: (reason: string) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!reason.trim()) {
      setError(t("contributors.admin.reasonRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(reason.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "error");
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 rounded border border-white/10 bg-white/[0.03] p-2">
      <Textarea
        label={label}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        rows={2}
      />
      {error ? <p className="mt-1 text-xs text-red-400">{error}</p> : null}
      <div className="mt-2 flex gap-2">
        <Button size="sm" loading={busy} onClick={submit}>
          {t("contributors.admin.extractions.correctionSubmit")}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          {t("contributors.admin.extractions.correctionCancel")}
        </Button>
      </div>
    </div>
  );
}

function PromotionControls({ observation, onDecided }: { observation: ObservationView; onDecided: () => void }) {
  const { t } = useLanguage();
  const [prompting, setPrompting] = useState<"promote" | "reject" | null>(null);

  async function decide(action: "promote" | "reject", reason: string) {
    if (action === "promote") {
      await promoteAdminContributorObservation(observation.id, { reason });
    } else {
      await rejectAdminContributorObservationPromotion(observation.id, { reason });
    }
    setPrompting(null);
    onDecided();
  }

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <Badge variant={promotionStatusVariant(observation.promotionStatus)}>
          {t(`contributors.admin.extractions.promotion.${observation.promotionStatus.toLowerCase()}`)}
        </Badge>
        {observation.promotionStatus !== "PROMOTED" ? (
          <Button size="sm" variant="ghost" onClick={() => setPrompting("promote")}>
            {t("contributors.admin.extractions.promotion.promote")}
          </Button>
        ) : null}
        {observation.promotionStatus !== "REJECTED" ? (
          <Button size="sm" variant="ghost" onClick={() => setPrompting("reject")}>
            {t("contributors.admin.extractions.promotion.reject")}
          </Button>
        ) : null}
      </div>
      {prompting ? (
        <PromotionReasonPrompt
          label={t(`contributors.admin.extractions.promotion.${prompting}Reason`)}
          onSubmit={(reason) => decide(prompting, reason)}
          onCancel={() => setPrompting(null)}
        />
      ) : null}
    </div>
  );
}

function ObservationCard({ observation, onCorrected }: { observation: ObservationView; onCorrected: () => void }) {
  const { t } = useLanguage();
  const [correcting, setCorrecting] = useState(false);

  const fields = OBSERVATION_FIELD_NAMES.map((field) => ({ field, value: observation[field] })).filter(
    (entry) => entry.value
  );

  return (
    <div className="mt-2 rounded border border-white/10 p-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <Badge variant={observation.isCorrected ? "success" : "default"}>
          {observation.isCorrected ? t("contributors.admin.extractions.corrected") : t("contributors.admin.extractions.raw")}
        </Badge>
        {!observation.isCorrected && !correcting ? (
          <Button size="sm" variant="ghost" onClick={() => setCorrecting(true)}>
            {t("contributors.admin.extractions.correct")}
          </Button>
        ) : null}
      </div>
      <dl className="mt-2 space-y-1">
        {fields.map(({ field, value }) => (
          <div key={field}>
            <dt className="font-semibold text-muted">{field.toUpperCase()}</dt>
            <dd className="text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      {correcting ? (
        <ObservationCorrectionForm
          observation={observation}
          onDone={() => {
            setCorrecting(false);
            onCorrected();
          }}
          onCancel={() => setCorrecting(false)}
        />
      ) : null}
      <PromotionControls observation={observation} onDecided={onCorrected} />
    </div>
  );
}

function ExtractionsSection({ submissionId }: { submissionId: string }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractions, setExtractions] = useState<KnowledgeExtractionView[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchAdminContributorExtractions(submissionId)
      .then(setExtractions)
      .catch((err) => setError(err instanceof Error ? err.message : "error"))
      .finally(() => setLoading(false));
  }, [submissionId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  return (
    <div className="mt-3">
      <Button size="sm" variant="ghost" onClick={() => setOpen((prev) => !prev)}>
        {open ? t("contributors.admin.extractions.toggleHide") : t("contributors.admin.extractions.toggleShow")}
      </Button>

      {open ? (
        <div className="mt-2">
          {loading ? (
            <div className="flex justify-center py-4">
              <Spinner />
            </div>
          ) : error ? (
            <ErrorState message={error} onRetry={load} />
          ) : extractions.length === 0 ? (
            <p className="text-xs text-muted">{t("contributors.admin.extractions.empty")}</p>
          ) : (
            <div className="space-y-3">
              {extractions.map((extraction) => (
                <div key={extraction.id} className="rounded border border-white/10 p-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={extractionStatusVariant(extraction.status)}>{extraction.status}</Badge>
                    <span className="text-xs text-muted">{extraction.kind}</span>
                  </div>

                  {extraction.status === "PENDING" ? (
                    <p className="mt-2 text-xs text-muted">{t("contributors.admin.extractions.pending")}</p>
                  ) : null}
                  {extraction.status === "PROCESSING" ? (
                    <p className="mt-2 text-xs text-muted">{t("contributors.admin.extractions.processing")}</p>
                  ) : null}
                  {extraction.status === "FAILED" ? (
                    <p className="mt-2 text-xs text-red-400">
                      {t("contributors.admin.extractions.failed")}
                      {extraction.failureReason ? `: ${extraction.failureReason}` : ""}
                    </p>
                  ) : null}

                  {extraction.transcriptSegments.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-xs">
                      {extraction.transcriptSegments.map((segment) => (
                        <li key={segment.id}>
                          <span className="font-mono text-muted">
                            [{formatMs(segment.startMs)}–{formatMs(segment.endMs)}]
                          </span>{" "}
                          {segment.text}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {extraction.observations.length > 0 ? (
                    <div className="mt-3">
                      <p className="text-xs font-semibold text-ink">{t("contributors.admin.extractions.observations")}</p>
                      {extraction.observations.map((observation) => (
                        <ObservationCard key={observation.id} observation={observation} onCorrected={load} />
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

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

      <ul className="mt-3 space-y-2 text-xs text-muted">
        {submission.assets.map((asset) => (
          <li key={asset.id}>
            <p>
              · {asset.kind} — {asset.clipRole} ({asset.processingStatus})
            </p>
            {asset.previewUrl && asset.kind === "VIDEO" ? (
              <video controls className="mt-1 max-h-64 w-full max-w-md rounded border border-line" src={asset.previewUrl} />
            ) : asset.previewUrl && asset.kind === "AUDIO" ? (
              <audio controls className="mt-1 w-full max-w-md" src={asset.previewUrl} />
            ) : asset.previewUrl && asset.kind === "IMAGE" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={asset.previewUrl}
                alt={`${asset.kind} — ${asset.clipRole}`}
                className="mt-1 max-h-64 max-w-md rounded border border-line object-contain"
              />
            ) : null}
          </li>
        ))}
      </ul>

      <ExtractionsSection submissionId={submission.id} />

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
