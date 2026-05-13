"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLanguage } from "../../../../../lib/language-context";
import { ArrowLeft, Save } from "lucide-react";
import { Badge, Button, Card, Input, Select, Textarea } from "@/components/ui";
import { buildOpsProjectStatusLabel, buildOpsProjectTypeLabel, buildOpsTradeLabel } from "../../../../lib/buildops-i18n";
import { createBuildOpsProject, type BuildOpsProjectStatus } from "../../../../lib/buildops-api";

type BuildOpsProjectInput = {
  title: string;
  description: string;
  trade: string;
  projectType: string;
  clientName: string;
  professionalName: string;
  location: string;
  budgetEstimate: string;
  status: string;
  startDate: string;
  dueDate: string;
};

const INITIAL_INPUT: BuildOpsProjectInput = {
  title: "",
  description: "",
  trade: "roofing",
  projectType: "remodel",
  clientName: "",
  professionalName: "",
  location: "",
  budgetEstimate: "",
  status: "draft",
  startDate: "",
  dueDate: "",
};

export default function NewBuildOpsProjectPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [input, setInput] = useState<BuildOpsProjectInput>(INITIAL_INPUT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);

    try {
      const project = await createBuildOpsProject({
        title: input.title.trim(),
        description: input.description.trim() || undefined,
        trade: input.trade,
        projectType: input.projectType,
        clientName: input.clientName.trim(),
        professionalName: input.professionalName.trim() || undefined,
        location: input.location.trim(),
        budgetEstimate: input.budgetEstimate.trim() ? Number(input.budgetEstimate) : undefined,
        status: input.status as BuildOpsProjectStatus,
        startDate: input.startDate || undefined,
        dueDate: input.dueDate || undefined,
      });

      router.push(`/buildops/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.serverError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <div className="grid gap-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/buildops/projects" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink">
            <ArrowLeft size={16} />
            {t("buildops.backToProjects")}
          </Link>
          <Badge variant="brand">BuildOps</Badge>
        </div>

        <section className="grid gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-ink">{t("buildops.newProject")}</h1>
          <p className="max-w-2xl text-sm text-muted">
            {t("buildops.newProjectIntro")}
          </p>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
        </section>

        <Card className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input label={t("buildops.title")} value={input.title} onChange={(event) => setInput({ ...input, title: event.target.value })} />
            <Select label={t("buildops.trade")} value={input.trade} onChange={(event) => setInput({ ...input, trade: event.target.value })}>
              <option value="roofing">{buildOpsTradeLabel(t, "roofing")}</option>
              <option value="concrete">{buildOpsTradeLabel(t, "concrete")}</option>
              <option value="plumbing">{buildOpsTradeLabel(t, "plumbing")}</option>
              <option value="hvac">{buildOpsTradeLabel(t, "hvac")}</option>
              <option value="electrical">{buildOpsTradeLabel(t, "electrical")}</option>
              <option value="painting">{buildOpsTradeLabel(t, "painting")}</option>
              <option value="drywall">{buildOpsTradeLabel(t, "drywall")}</option>
              <option value="flooring">{buildOpsTradeLabel(t, "flooring")}</option>
              <option value="carpentry">{buildOpsTradeLabel(t, "carpentry")}</option>
              <option value="tile">{buildOpsTradeLabel(t, "tile")}</option>
              <option value="windows-doors">{buildOpsTradeLabel(t, "windows-doors")}</option>
              <option value="insulation">{buildOpsTradeLabel(t, "insulation")}</option>
              <option value="demolition">{buildOpsTradeLabel(t, "demolition")}</option>
              <option value="masonry">{buildOpsTradeLabel(t, "masonry")}</option>
            </Select>
            <Input label={t("buildops.clientName")} value={input.clientName} onChange={(event) => setInput({ ...input, clientName: event.target.value })} />
            <Input label={t("buildops.professionalName")} value={input.professionalName} onChange={(event) => setInput({ ...input, professionalName: event.target.value })} />
            <Input label={t("job.location")} value={input.location} onChange={(event) => setInput({ ...input, location: event.target.value })} />
            <Input label={t("buildops.budgetEstimate")} value={input.budgetEstimate} onChange={(event) => setInput({ ...input, budgetEstimate: event.target.value })} />
            <Select label={t("buildops.projectType")} value={input.projectType} onChange={(event) => setInput({ ...input, projectType: event.target.value })}>
              <option value="remodel">{buildOpsProjectTypeLabel(t, "remodel")}</option>
              <option value="newConstruction">{buildOpsProjectTypeLabel(t, "newConstruction")}</option>
              <option value="repair">{buildOpsProjectTypeLabel(t, "repair")}</option>
              <option value="service">{buildOpsProjectTypeLabel(t, "service")}</option>
            </Select>
            <Select label={t("buildops.statusLabel")} value={input.status} onChange={(event) => setInput({ ...input, status: event.target.value })}>
              <option value="draft">{buildOpsProjectStatusLabel(t, "draft")}</option>
              <option value="estimating">{buildOpsProjectStatusLabel(t, "estimating")}</option>
              <option value="quoted">{buildOpsProjectStatusLabel(t, "quoted")}</option>
              <option value="approved">{buildOpsProjectStatusLabel(t, "approved")}</option>
              <option value="in_progress">{buildOpsProjectStatusLabel(t, "in_progress")}</option>
            </Select>
            <Input label={t("buildops.startDate")} type="date" value={input.startDate} onChange={(event) => setInput({ ...input, startDate: event.target.value })} />
            <Input label={t("buildops.dueDate")} type="date" value={input.dueDate} onChange={(event) => setInput({ ...input, dueDate: event.target.value })} />
            <div className="md:col-span-2">
              <Textarea
                label={t("buildops.description")}
                rows={5}
                value={input.description}
                onChange={(event) => setInput({ ...input, description: event.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-white/[0.08] pt-4">
            <p className="text-sm text-muted">{t("buildops.savedProjectPrisma")}</p>
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              <Save size={16} />
              {saving ? t("buildops.savingProject") : t("buildops.saveProject")}
            </Button>
          </div>
        </Card>
      </div>
    </main>
  );
}
