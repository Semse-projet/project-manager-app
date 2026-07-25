import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  clearJobWizardDraft,
  hasMeaningfulJobWizardProgress,
  parseJobWizardDraft,
  readJobWizardDraft,
  writeJobWizardDraft,
  type JobWizardDraft,
} from "../../apps/web/lib/job-wizard-draft.ts";

class MemoryStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const NOW = Date.UTC(2026, 6, 25, 12);
const wizardSource = readFileSync(
  "apps/web/app/(app)/client/jobs/new/page.tsx",
  "utf8",
);

function completeDraft(overrides: Partial<JobWizardDraft> = {}): JobWizardDraft {
  return {
    version: 1,
    savedAt: NOW,
    step: 4,
    activeIntakeId: "intake-1",
    categoryId: "pintura",
    subcategoryId: "interior",
    title: "Pintar sala principal",
    description: "Pintar paredes y techo con dos capas de pintura.",
    locationType: "on_site",
    city: "Miami, FL",
    budgetType: "range",
    budgetMin: 1200,
    budgetMax: 1800,
    urgency: "medium",
    deadline: "2026-08-15",
    hadFiles: false,
    ...overrides,
  };
}

test("wizard draft round-trips per user and clears intentionally", () => {
  const storage = new MemoryStorage();
  const draft = completeDraft();

  writeJobWizardDraft(storage, "client-a", draft);

  assert.deepEqual(readJobWizardDraft(storage, "client-a", NOW), draft);
  assert.equal(readJobWizardDraft(storage, "client-b", NOW), null);

  clearJobWizardDraft(storage, "client-a");
  assert.equal(readJobWizardDraft(storage, "client-a", NOW), null);
});

test("wizard draft rejects malformed, future, and expired payloads", () => {
  assert.equal(parseJobWizardDraft("{broken", NOW), null);
  assert.equal(parseJobWizardDraft(JSON.stringify(completeDraft({ savedAt: NOW + 1 })), NOW), null);
  assert.equal(
    parseJobWizardDraft(JSON.stringify(completeDraft({ savedAt: NOW - 25 * 60 * 60 * 1000 })), NOW),
    null,
  );
});

test("wizard draft never restores a step beyond the completed fields", () => {
  const parsed = parseJobWizardDraft(
    JSON.stringify(completeDraft({
      step: 4,
      title: "",
      description: "",
    })),
    NOW,
  );

  assert.equal(parsed?.step, 2);
});

test("blank defaults are not persisted as meaningful progress", () => {
  assert.equal(hasMeaningfulJobWizardProgress(completeDraft({
    step: 1,
    activeIntakeId: "",
    categoryId: "",
    subcategoryId: "",
    title: "",
    description: "",
    city: "",
    deadline: "",
  })), false);
});

test("wizard page restores and writes the user-scoped session draft", () => {
  assert.match(
    wizardSource,
    /readJobWizardDraft\(window\.sessionStorage, user\.id\)/,
  );
  assert.match(
    wizardSource,
    /writeJobWizardDraft\(window\.sessionStorage, user\.id, draft\)/,
  );
  assert.match(wizardSource, /clearJobWizardDraft\(window\.sessionStorage, user\.id\)/);
});

test("wizard warns before a refresh would discard selected file handles", () => {
  assert.match(wizardSource, /addEventListener\("beforeunload", warnAboutFiles\)/);
  assert.match(wizardSource, /vuelve\s+[\s\S]*a seleccionar los archivos adjuntos/);
});
