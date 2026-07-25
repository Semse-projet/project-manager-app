import type { JobBudgetType, JobLocationType } from "./job-intake";

const DRAFT_VERSION = 1;
const MAX_DRAFT_AGE_MS = 24 * 60 * 60 * 1000;
const KEY_PREFIX = "semse:client:new-job-draft";

type DraftStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type JobWizardDraft = {
  version: typeof DRAFT_VERSION;
  savedAt: number;
  step: number;
  activeIntakeId: string;
  categoryId: string;
  subcategoryId: string;
  title: string;
  description: string;
  locationType: JobLocationType;
  city: string;
  // Picked map location; null when none was chosen (and for drafts saved
  // before coordinates were part of the draft).
  latitude: number | null;
  longitude: number | null;
  budgetType: JobBudgetType;
  budgetMin: number;
  budgetMax: number;
  urgency: string;
  deadline: string;
  hadFiles: boolean;
};

function storageKey(userId: string): string {
  return `${KEY_PREFIX}:v${DRAFT_VERSION}:${encodeURIComponent(userId)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readCoordinate(value: unknown, limit: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= limit
    ? value
    : null;
}

function maxAvailableStep(draft: Omit<JobWizardDraft, "step">): number {
  if (!draft.categoryId || !draft.subcategoryId) return 1;
  if (draft.title.length < 5 || draft.description.length < 20) return 2;
  if (draft.budgetMin <= 0 || draft.budgetMax < draft.budgetMin) return 3;
  return 4;
}

export function parseJobWizardDraft(
  serialized: string | null,
  now = Date.now(),
): JobWizardDraft | null {
  if (!serialized) return null;

  try {
    const raw: unknown = JSON.parse(serialized);
    if (!isRecord(raw) || raw.version !== DRAFT_VERSION) return null;
    if (
      typeof raw.savedAt !== "number"
      || !Number.isFinite(raw.savedAt)
      || raw.savedAt > now
      || now - raw.savedAt > MAX_DRAFT_AGE_MS
    ) {
      return null;
    }

    const locationType = raw.locationType;
    const budgetType = raw.budgetType;
    if (
      locationType !== "remote"
      && locationType !== "on_site"
      && locationType !== "hybrid"
    ) {
      return null;
    }
    if (budgetType !== "fixed" && budgetType !== "range" && budgetType !== "hourly") {
      return null;
    }
    if (
      typeof raw.budgetMin !== "number"
      || !Number.isFinite(raw.budgetMin)
      || typeof raw.budgetMax !== "number"
      || !Number.isFinite(raw.budgetMax)
    ) {
      return null;
    }

    const draftWithoutStep = {
      version: DRAFT_VERSION,
      savedAt: raw.savedAt,
      activeIntakeId: readString(raw.activeIntakeId),
      categoryId: readString(raw.categoryId),
      subcategoryId: readString(raw.subcategoryId),
      title: readString(raw.title),
      description: readString(raw.description),
      locationType,
      city: readString(raw.city),
      budgetType,
      budgetMin: raw.budgetMin,
      budgetMax: raw.budgetMax,
      urgency: readString(raw.urgency),
      deadline: readString(raw.deadline),
      hadFiles: typeof raw.hadFiles === "boolean" ? raw.hadFiles : false,
    };
    if (Object.values(draftWithoutStep).some(value => value === null)) return null;

    const requestedStep = typeof raw.step === "number" && Number.isInteger(raw.step)
      ? Math.min(4, Math.max(1, raw.step))
      : 1;
    const draft = {
      ...draftWithoutStep,
      latitude: readCoordinate(raw.latitude, 90),
      longitude: readCoordinate(raw.longitude, 180),
    } as Omit<JobWizardDraft, "step">;

    return {
      ...draft,
      step: Math.min(requestedStep, maxAvailableStep(draft)),
    };
  } catch {
    return null;
  }
}

export function hasMeaningfulJobWizardProgress(draft: JobWizardDraft): boolean {
  return Boolean(
    draft.activeIntakeId
    || draft.categoryId
    || draft.subcategoryId
    || draft.title
    || draft.description
    || draft.city
    || draft.deadline
    || draft.hadFiles
    || draft.step > 1,
  );
}

export function readJobWizardDraft(
  storage: DraftStorage,
  userId: string,
  now = Date.now(),
): JobWizardDraft | null {
  try {
    const key = storageKey(userId);
    const draft = parseJobWizardDraft(storage.getItem(key), now);
    if (!draft) storage.removeItem(key);
    return draft;
  } catch {
    return null;
  }
}

export function writeJobWizardDraft(
  storage: DraftStorage,
  userId: string,
  draft: JobWizardDraft,
): void {
  try {
    storage.setItem(storageKey(userId), JSON.stringify(draft));
  } catch {
    // Storage can be unavailable or full; the wizard remains usable in memory.
  }
}

export function clearJobWizardDraft(storage: DraftStorage, userId: string): void {
  try {
    storage.removeItem(storageKey(userId));
  } catch {
    // Clearing a best-effort browser draft must not block navigation.
  }
}
