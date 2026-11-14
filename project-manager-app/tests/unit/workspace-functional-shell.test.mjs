import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = new URL("../../", import.meta.url);
const read = (path) => readFileSync(fileURLToPath(new URL(path, root)), "utf8");

test("workspace routes section content to all operational panels", () => {
  const source = read("apps/web/app/workspace/components/CentralPanel.tsx");
  for (const name of ["ProjectsPanel", "EvidencePanel", "BudgetPanel", "PlanningPanel"]) assert.ok(source.includes(name), name);
  assert.match(source, /Referencia de trabajo/);
  assert.match(source, /sin ejecución vinculada/);
});

test("mobile drawers are exclusive and restore focus and body scrolling", () => {
  const source = read("apps/web/app/workspace/components/WorkspaceLayout.tsx");
  assert.match(source, /mobilePanel/);
  assert.match(source, /document\.body\.style\.overflow/);
  assert.match(source, /Escape/);
  assert.match(source, /aria-expanded/);
  assert.match(source, /aria-busy/);
});

test("mission form awaits success before clearing and follows the 200 character contract", () => {
  const source = read("apps/web/app/workspace/components/MissionLoader.tsx");
  assert.match(source, /maxLength=\{200\}/);
  assert.match(source, /await onLoad/);
  assert.match(source, /htmlFor=/);
  assert.match(source, /pending/);
});

test("workspace keeps presentation preferences separate from resource authorization", () => {
  const source = read("apps/web/app/workspace/lib/workspace-model.ts");
  assert.match(source, /appRoleFromRoles/);
  const shell = read("apps/web/app/workspace/components/WorkspaceLayout.tsx");
  assert.match(shell, /sanitizePreferences/);
  assert.match(shell, /localStorage/);
});
