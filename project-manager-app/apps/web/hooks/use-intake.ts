"use client";

import { useEffect, useState } from "react";
import type {
  AnalyzeIntakeResponse,
  AnswerIntakeResponse,
  EstimateIntakeResponse,
  IntakeAnswerInput,
  IntakeQuestion,
  IntakeWarning,
  ProjectEstimate,
  ProjectIntake,
  ProjectMilestone,
  BilingualString,
  LiveSummary,
} from "../lib/smart-intake";

const INTAKE_DRAFT_KEY = "intake_draft_id";

async function readJson<T>(response: Response): Promise<T> {
  const json = await response.json() as { data?: T; error?: { message?: string } };
  if (!response.ok || !json.data) {
    throw new Error(json.error?.message ?? "Request failed");
  }
  return json.data;
}

export function getPersistedIntakeId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(INTAKE_DRAFT_KEY);
}

export function clearPersistedIntakeId(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(INTAKE_DRAFT_KEY);
}

export function useIntake(initialIntakeId?: string) {
  const [intakeId, setIntakeId] = useState<string | null>(initialIntakeId ?? null);
  const [intake, setIntake] = useState<ProjectIntake | null>(null);
  const [nextQuestion, setNextQuestion] = useState<IntakeQuestion | null>(null);
  const [warnings, setWarnings] = useState<IntakeWarning[]>([]);
  const [tips, setTips] = useState<BilingualString[]>([]);
  const [liveSummary, setLiveSummary] = useState<LiveSummary | null>(null);
  const [estimate, setEstimate] = useState<ProjectEstimate | null>(null);
  const [milestones, setMilestones] = useState<ProjectMilestone[]>([]);
  const [estimateUnlocked, setEstimateUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!intakeId || typeof window === "undefined") return;
    window.localStorage.setItem(INTAKE_DRAFT_KEY, intakeId);
  }, [intakeId]);

  async function analyzeDescription(input: {
    rawDescription: string;
    title?: string;
    category?: string;
    subcategory?: string;
    modality?: "on_site" | "remote" | "hybrid";
    city?: string;
    urgency?: "low" | "medium" | "high" | "urgent";
  }) {
    setIsLoading(true);
    try {
      const response = await fetch("/api/semse/public/intake/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          intakeId: intakeId ?? undefined,
          ...input,
        }),
      });
      const data = await readJson<AnalyzeIntakeResponse>(response);
      setIntakeId(data.intakeId);
      setNextQuestion(data.nextQuestion);
      setTips(data.tips);
      setEstimateUnlocked(data.estimateUnlocked);
      await loadIntake(data.intakeId);
      return data;
    } finally {
      setIsLoading(false);
    }
  }

  async function loadIntake(id: string) {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/semse/public/intake/${encodeURIComponent(id)}`, { cache: "no-store" });
      const data = await readJson<ProjectIntake>(response);
      setIntakeId(data.id);
      setIntake(data);
      setWarnings(data.activeWarnings ?? []);
      setEstimate(data.generatedEstimate ?? null);
      setMilestones(data.generatedMilestones ?? []);
      setEstimateUnlocked(data.accuracyScore >= 36);
      return data;
    } finally {
      setIsLoading(false);
    }
  }

  async function submitAnswer(answer: IntakeAnswerInput) {
    if (!intakeId) {
      throw new Error("No intake draft exists yet");
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/semse/public/intake/${encodeURIComponent(intakeId)}/answer`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(answer),
      });
      const data = await readJson<AnswerIntakeResponse>(response);
      setNextQuestion(data.nextQuestion);
      setWarnings(data.activeWarnings);
      setTips(data.tips);
      setLiveSummary(data.liveSummary);
      setEstimateUnlocked(data.estimateUnlocked);
      await loadIntake(intakeId);
      return data;
    } finally {
      setIsLoading(false);
    }
  }

  async function uploadImages(files: File[], imageType: "before" | "damage" | "reference" | "material" | "other" = "before") {
    if (!intakeId) {
      throw new Error("No intake draft exists yet");
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.set("imageType", imageType);
      for (const file of files) {
        formData.append("files", file);
      }

      const response = await fetch(`/api/semse/public/intake/${encodeURIComponent(intakeId)}/images`, {
        method: "POST",
        body: formData,
      });
      const data = await readJson<{
        uploadedImages: unknown[];
        accuracyScoreDelta: number;
        newAccuracyScore: number;
        estimateUnlocked: boolean;
      }>(response);
      setEstimateUnlocked(data.estimateUnlocked);
      await loadIntake(intakeId);
      return data;
    } finally {
      setIsLoading(false);
    }
  }

  async function requestEstimate(force = false) {
    if (!intakeId) {
      throw new Error("No intake draft exists yet");
    }

    setIsLoading(true);
    try {
      const suffix = force ? "?force=true" : "";
      const response = await fetch(`/api/semse/public/intake/${encodeURIComponent(intakeId)}/estimate${suffix}`, {
        method: "POST",
      });
      const data = await readJson<EstimateIntakeResponse>(response);
      setEstimate(data.estimate);
      setMilestones(data.milestones);
      await loadIntake(intakeId);
      return data;
    } finally {
      setIsLoading(false);
    }
  }

  async function claimDraft(id: string) {
    const response = await fetch(`/api/semse/intake/${encodeURIComponent(id)}/claim`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    return readJson<{ intakeId: string; claimed: boolean; userId: string }>(response);
  }

  return {
    intakeId,
    intake,
    nextQuestion,
    warnings,
    tips,
    liveSummary,
    estimate,
    milestones,
    estimateUnlocked,
    isLoading,
    analyzeDescription,
    loadIntake,
    submitAnswer,
    uploadImages,
    requestEstimate,
    claimDraft,
  };
}
