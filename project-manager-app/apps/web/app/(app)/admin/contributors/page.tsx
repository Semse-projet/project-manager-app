"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { GraduationCap, Plus } from "lucide-react";
import { AdminPageHeader } from "../../../components/admin/AdminPageHeader";
import { useLanguage } from "../../../../lib/language-context";
import { Badge, Button, Card, ErrorState, Input, Select, Spinner, Textarea } from "../../../../components/ui";
import {
  createAdminContributorMission,
  fetchAdminContributorMissions,
  pauseAdminContributorMission,
  publishAdminContributorMission,
  closeAdminContributorMission,
  type KnowledgeMissionView,
} from "../../../semse-api";

function emptyForm() {
  return {
    title: "",
    trade: "electrician",
    category: "",
    description: "",
    difficulty: "intermediate" as "beginner" | "intermediate" | "advanced",
    requirements: "",
    evidenceRequested: "",
    acceptanceCriteria: "",
    baseCompensationCents: "",
    currency: "USD",
    isDemo: false,
  };
}

function linesToArray(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function AdminContributorMissionsPage() {
  const { t } = useLanguage();
  const [missions, setMissions] = useState<KnowledgeMissionView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchAdminContributorMissions()
      .then(setMissions)
      .catch((err) => setError(err instanceof Error ? err.message : "error"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const cents = Math.round(Number(form.baseCompensationCents || "0") * 100);
      await createAdminContributorMission({
        title: form.title,
        trade: form.trade,
        category: form.category,
        description: form.description,
        difficulty: form.difficulty,
        requirements: linesToArray(form.requirements),
        evidenceRequested: linesToArray(form.evidenceRequested),
        acceptanceCriteria: linesToArray(form.acceptanceCriteria),
        baseCompensationCents: cents,
        currency: form.currency,
        isDemo: form.isDemo,
      });
      setForm(emptyForm());
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "error");
    } finally {
      setCreating(false);
    }
  }

  async function handleStatusAction(id: string, action: "publish" | "pause" | "close") {
    setBusyId(id);
    try {
      const fn = action === "publish" ? publishAdminContributorMission : action === "pause" ? pauseAdminContributorMission : closeAdminContributorMission;
      await fn(id);
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
        subtitle={t("contributors.admin.missions")}
        icon={GraduationCap}
        backHref="/admin/dashboard"
        actions={
          <Button size="sm" onClick={() => setShowForm((prev) => !prev)}>
            <Plus size={14} /> {t("contributors.admin.newMission")}
          </Button>
        }
      />

      {error ? (
        <div className="mt-4">
          <ErrorState message={error} />
        </div>
      ) : null}

      {showForm ? (
        <Card className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Título" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Input label="Oficio (trade)" value={form.trade} onChange={(e) => setForm({ ...form, trade: e.target.value })} />
            <Input label="Categoría" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            <Select
              label="Dificultad"
              value={form.difficulty}
              onChange={(e) => setForm({ ...form, difficulty: e.target.value as typeof form.difficulty })}
            >
              <option value="beginner">beginner</option>
              <option value="intermediate">intermediate</option>
              <option value="advanced">advanced</option>
            </Select>
          </div>
          <Textarea label="Descripción" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Textarea label="Requisitos (uno por línea)" rows={3} value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} />
          <Textarea label="Evidencia solicitada (uno por línea)" rows={3} value={form.evidenceRequested} onChange={(e) => setForm({ ...form, evidenceRequested: e.target.value })} />
          <Textarea label="Criterios de aprobación (uno por línea)" rows={3} value={form.acceptanceCriteria} onChange={(e) => setForm({ ...form, acceptanceCriteria: e.target.value })} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Input label="Compensación (USD)" type="number" min="0" value={form.baseCompensationCents} onChange={(e) => setForm({ ...form, baseCompensationCents: e.target.value })} />
            <label className="flex items-center gap-2 self-end pb-2 text-xs text-ink">
              <input type="checkbox" checked={form.isDemo} onChange={(e) => setForm({ ...form, isDemo: e.target.checked })} />
              Demo / test (compensación simbólica)
            </label>
          </div>
          <Button onClick={handleCreate} loading={creating} disabled={!form.title || !form.description}>
            {t("contributors.admin.newMission")}
          </Button>
        </Card>
      ) : null}

      <div className="mt-6">
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <div className="space-y-3">
            {missions.map((mission) => (
              <Card key={mission.id} className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Link href={`/contributors/missions/${mission.id}`} target="_blank" className="text-sm font-semibold text-ink hover:underline">
                      {mission.title}
                    </Link>
                    {mission.isDemo ? <Badge variant="warn">demo</Badge> : null}
                    <Badge>{mission.status}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {mission.trade} · v{mission.version} · {mission.acceptedCount ?? 0} {t("contributors.missions.accepted")}
                  </p>
                </div>
                <div className="flex gap-2">
                  {mission.status !== "PUBLISHED" ? (
                    <Button size="sm" variant="ghost" loading={busyId === mission.id} onClick={() => handleStatusAction(mission.id, "publish")}>
                      {t("contributors.admin.publish")}
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" loading={busyId === mission.id} onClick={() => handleStatusAction(mission.id, "pause")}>
                      {t("contributors.admin.pause")}
                    </Button>
                  )}
                  {mission.status !== "CLOSED" && mission.status !== "ARCHIVED" ? (
                    <Button size="sm" variant="destructive" loading={busyId === mission.id} onClick={() => handleStatusAction(mission.id, "close")}>
                      {t("contributors.admin.close")}
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
