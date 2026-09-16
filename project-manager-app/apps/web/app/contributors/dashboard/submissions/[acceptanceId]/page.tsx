"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { Badge, Button, Card, ErrorState, Spinner, Textarea, statusVariant } from "../../../../../components/ui";
import { useLanguage } from "../../../../../lib/language-context";
import {
  appealContributorSubmission,
  createContributorSubmission,
  fetchContributorDashboard,
  planUpload,
  registerContributorAsset,
  submitContributorSubmission,
  type ContributorDashboardView,
  type KnowledgeAssetView,
  type KnowledgeSubmissionView,
} from "../../../../semse-api";

const CLIP_ROLES = [
  { role: "BEFORE" as const, key: "before" },
  { role: "PLANNING" as const, key: "planning" },
  { role: "EXECUTION" as const, key: "execution" },
  { role: "PROBLEM_CORRECTION" as const, key: "problem" },
  { role: "RESULT" as const, key: "result" },
];

function mimeToKind(mime: string): "VIDEO" | "IMAGE" | "AUDIO" {
  if (mime.startsWith("video/")) return "VIDEO";
  if (mime.startsWith("audio/")) return "AUDIO";
  return "IMAGE";
}

function formatCents(cents: number, currency: string, locale: "es" | "en"): string {
  return new Intl.NumberFormat(locale === "es" ? "es-MX" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function ClipUploader({
  clipRole,
  label,
  submissionId,
  onUploaded,
}: {
  clipRole: (typeof CLIP_ROLES)[number]["role"];
  label: string;
  submissionId: string;
  onUploaded: (asset: KnowledgeAssetView) => void;
}) {
  const { t } = useLanguage();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const contentType = file.type || "application/octet-stream";
      const plan = await planUpload({
        domain: "knowledge_contribution",
        filename: file.name,
        contentType,
        fileSizeBytes: file.size,
        source: "local_device",
      });
      const key = typeof plan.key === "string" ? plan.key : undefined;
      const strategy = typeof plan.recommendedStrategy === "string" ? plan.recommendedStrategy : "single_put";
      if (!key || strategy === "external_transfer") {
        throw new Error("El archivo es demasiado grande para subirlo aquí todavía (límite ~25MB).");
      }

      const putRes = await fetch(`/api/semse/uploads/files/${encodeURIComponent(key)}`, {
        method: "PUT",
        headers: { "content-type": contentType, "content-length": String(file.size) },
        body: file,
      });
      if (!putRes.ok) throw new Error("No se pudo subir el archivo.");

      const asset = await registerContributorAsset(submissionId, {
        kind: mimeToKind(contentType),
        clipRole,
        key,
        filename: file.name,
        mimeType: contentType,
        sizeBytes: file.size,
      });
      onUploaded(asset);
    } catch (err) {
      setError(err instanceof Error ? err.message : "error");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="rounded-lg border border-dashed border-white/[0.12] p-3">
      <p className="text-xs font-semibold text-ink">{label}</p>
      <input
        ref={inputRef}
        type="file"
        accept="video/*,image/*,audio/*"
        className="mt-2 block w-full text-xs text-muted file:mr-3 file:rounded-md file:border-0 file:bg-brand/10 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-brand"
        disabled={uploading}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      {uploading ? <p className="mt-1 text-xs text-muted">{t("contributors.submission.uploading")}</p> : null}
      {error ? <p className="mt-1 text-xs text-red-400">{error}</p> : null}
    </div>
  );
}

function TextNoteAdder({ submissionId, onAdded }: { submissionId: string; onAdded: (asset: KnowledgeAssetView) => void }) {
  const { t } = useLanguage();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const asset = await registerContributorAsset(submissionId, {
        kind: "TEXT",
        clipRole: "OTHER",
        textContent: text.trim(),
      });
      onAdded(asset);
      setText("");
    } catch {
      /* surfaced via submission-level error state */
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-dashed border-white/[0.12] p-3">
      <Textarea
        placeholder={t("contributors.submission.addNote")}
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={2}
      />
      <div className="mt-2">
        <Button size="sm" variant="ghost" onClick={handleAdd} loading={saving} disabled={!text.trim()}>
          {t("contributors.submission.addNote")}
        </Button>
      </div>
    </div>
  );
}

export default function SubmissionWorkspacePage({ params }: { params: Promise<{ acceptanceId: string }> }) {
  const { acceptanceId } = use(params);
  const { t, language } = useLanguage();
  const [dashboard, setDashboard] = useState<ContributorDashboardView | null>(null);
  const [submission, setSubmission] = useState<KnowledgeSubmissionView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [appealReason, setAppealReason] = useState("");
  const [appealSubmitting, setAppealSubmitting] = useState(false);
  const [appealDone, setAppealDone] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchContributorDashboard();
      setDashboard(data);
      let existing = data.submissions.find((item) => item.acceptanceId === acceptanceId) ?? null;
      if (!existing) {
        const created = await createContributorSubmission(acceptanceId);
        const refreshed = await fetchContributorDashboard();
        setDashboard(refreshed);
        existing = refreshed.submissions.find((item) => item.id === created.id) ?? null;
      }
      setSubmission(existing);
      setNotes(existing?.notes ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "error");
    } finally {
      setLoading(false);
    }
  }, [acceptanceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const acceptance = dashboard?.acceptances.find((item) => item.id === acceptanceId);

  async function handleSubmit() {
    if (!submission) return;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await submitContributorSubmission(submission.id, notes.trim() || undefined);
      setSubmission(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAppeal() {
    if (!submission || !appealReason.trim()) return;
    setAppealSubmitting(true);
    try {
      await appealContributorSubmission(submission.id, appealReason.trim());
      setAppealDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "error");
    } finally {
      setAppealSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (error && !submission) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <ErrorState message={error} onRetry={load} />
      </div>
    );
  }

  if (!submission) return null;

  const editable = submission.status === "DRAFT" || submission.status === "CHANGES_REQUESTED";
  const rejected = submission.status === "REJECTED";

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-black text-ink sm:text-xl">{submission.missionTitle}</h1>
          <p className="mt-1 text-xs text-muted">
            {formatCents(submission.compensationCentsSnapshot, submission.currencySnapshot, language)}
            {acceptance?.deadlineAtSnapshot
              ? ` · ${t("contributors.missions.deadline")}: ${new Date(acceptance.deadlineAtSnapshot).toLocaleDateString()}`
              : ""}
          </p>
        </div>
        <Badge variant={statusVariant(submission.status)}>{submission.status}</Badge>
      </div>

      {error ? (
        <div className="mt-4">
          <ErrorState message={error} />
        </div>
      ) : null}

      <section className="mt-6">
        <h2 className="text-sm font-bold text-ink">{t("contributors.submission.clips")}</h2>
        <p className="mt-1 text-xs text-muted">{t("contributors.submission.clip.skip")}</p>

        <div className="mt-3 space-y-2">
          {submission.assets.map((asset) => (
            <div key={asset.id} className="flex items-center justify-between rounded-lg border border-white/[0.08] px-3 py-2 text-xs">
              <span className="text-ink">
                {asset.kind} · {asset.clipRole}
              </span>
              <Badge variant={asset.processingStatus === "FAILED" ? "error" : "default"}>{asset.processingStatus}</Badge>
            </div>
          ))}
        </div>

        {editable ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {CLIP_ROLES.map(({ role, key }) => (
              <ClipUploader
                key={role}
                clipRole={role}
                label={t(`contributors.submission.clip.${key}`)}
                submissionId={submission.id}
                onUploaded={(asset) => setSubmission((prev) => (prev ? { ...prev, assets: [...prev.assets, asset] } : prev))}
              />
            ))}
            <div className="sm:col-span-2">
              <TextNoteAdder
                submissionId={submission.id}
                onAdded={(asset) => setSubmission((prev) => (prev ? { ...prev, assets: [...prev.assets, asset] } : prev))}
              />
            </div>
          </div>
        ) : null}
      </section>

      {editable ? (
        <section className="mt-6">
          <Textarea
            label={t("contributors.submission.notes")}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
          />
          {submission.assets.length === 0 ? (
            <p className="mt-2 text-xs text-amber-300">{t("contributors.submission.needsAsset")}</p>
          ) : null}
          <div className="mt-4">
            <Button
              className="w-full sm:w-auto"
              onClick={handleSubmit}
              loading={submitting}
              disabled={submission.assets.length === 0}
            >
              {t("contributors.submission.submit")}
            </Button>
          </div>
        </section>
      ) : null}

      {rejected ? (
        <section className="mt-6">
          <Card>
            <p className="text-xs font-bold uppercase tracking-widest text-faint">{t("contributors.review.rejected")}</p>
            {appealDone ? (
              <p className="mt-2 text-sm text-ink">{t("contributors.submission.appealSubmitted")}</p>
            ) : (
              <>
                <Textarea
                  label={t("contributors.submission.appealReason")}
                  value={appealReason}
                  onChange={(event) => setAppealReason(event.target.value)}
                  rows={3}
                  className="mt-3"
                />
                <div className="mt-3">
                  <Button
                    variant="ghost"
                    onClick={handleAppeal}
                    loading={appealSubmitting}
                    disabled={!appealReason.trim()}
                  >
                    {t("contributors.submission.appeal")}
                  </Button>
                </div>
              </>
            )}
          </Card>
        </section>
      ) : null}
    </div>
  );
}
