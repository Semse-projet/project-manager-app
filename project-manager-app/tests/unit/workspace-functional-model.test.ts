import test from "node:test";
import assert from "node:assert/strict";
import {
  WORKSPACE_SECTIONS,
  getWorkspaceSection,
  getMissionTypeLabel,
  validateMissionTitle,
  sanitizePreferences,
  DEFAULT_WORKSPACE_PREFERENCES,
  getWorkspaceRole,
} from "../../apps/web/app/workspace/lib/workspace-model.ts";

test("workspace preserves the six identifiers and presents Spanish labels", () => {
  assert.deepEqual(WORKSPACE_SECTIONS.map((s) => s.id), ["home", "projects", "evidence", "budget", "planning", "settings"]);
  assert.equal(getWorkspaceSection("projects").label, "Proyectos");
  assert.equal(getWorkspaceSection("planning").label, "Planificación");
  assert.equal(getWorkspaceSection("missing").id, "home");
  assert.equal(getMissionTypeLabel("project"), "Proyecto");
});

test("mission title follows the shared contract and rejects whitespace", () => {
  assert.ok(validateMissionTitle("   "));
  assert.ok(validateMissionTitle("a".repeat(201)));
  assert.equal(validateMissionTitle("  Revisión de obra  "), null);
  assert.equal(validateMissionTitle("a".repeat(200)), null);
});

test("preferences retain only valid visual fields, never business context", () => {
  const result = sanitizePreferences({ density: "compact", leftPanel: false, rightPanel: true, projectId: "private", token: "secret" });
  assert.deepEqual(result, { density: "compact", leftPanel: false, rightPanel: true });
  assert.deepEqual(sanitizePreferences(null), DEFAULT_WORKSPACE_PREFERENCES);
  assert.deepEqual(sanitizePreferences({ density: "invalid", leftPanel: "false", rightPanel: 0 }), DEFAULT_WORKSPACE_PREFERENCES);
  assert.equal(Object.hasOwn(result, "projectId"), false);
});

test("presentation roles reuse canonical aliases and fail closed for unknown roles", () => {
  assert.equal(getWorkspaceRole([]), null);
  assert.equal(getWorkspaceRole(["DEMO_AGRO"]), null);
  assert.equal(getWorkspaceRole(["CLIENT"]), "client");
  assert.equal(getWorkspaceRole(["PRO"]), "worker");
  assert.equal(getWorkspaceRole(["FIELD_WORKER"]), "worker");
  assert.equal(getWorkspaceRole(["ADMIN", "PRO"]), "admin");
});
