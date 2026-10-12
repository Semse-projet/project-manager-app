import test from "node:test";
import assert from "node:assert/strict";
import { buildShellNavItems, type ShellNavItem } from "../../apps/web/lib/navigation-shell.ts";

function icon() {
  return null;
}

const adminItems: ShellNavItem[] = [
  { labelKey: "nav.dashboard", href: "/admin/dashboard", icon },
  { labelKey: "nav.operations", href: "/admin/ops", icon },
  { labelKey: "nav.marketplace", href: "/admin/marketplace", icon },
  { labelKey: "nav.disputes", href: "/admin/disputes", icon },
  { labelKey: "nav.aiMissionControl", href: "/admin/ai-mission-control", icon },
  { labelKey: "nav.settings", href: "/admin/settings", icon },
];

test("admin shell nav items render as a flat list, same shape as worker/client", () => {
  const navItems = buildShellNavItems({
    role: "admin",
    items: adminItems,
    collapsed: false,
    pathname: "/admin/ops",
    t: (key) => key,
  });

  assert.equal(navItems.length, adminItems.length);
  assert.ok(navItems.every((item) => "href" in item && "active" in item), "admin nav should be flat ShellNavLink entries, not grouped");
  assert.equal(navItems[1].label, "nav.operations");
  assert.equal(navItems[1].active, true);
});

test("non-admin shell nav items remain flat", () => {
  const navItems = buildShellNavItems({
    role: "client",
    items: [{ labelKey: "nav.dashboard", href: "/client/dashboard", icon }],
    collapsed: false,
    pathname: "/client/dashboard",
    t: (key) => key,
  });

  assert.equal(navItems.length, 1);
  assert.equal(navItems[0].key, "/client/dashboard");
  assert.equal(navItems[0].label, "nav.dashboard");
});

const clientItems: ShellNavItem[] = [
  { labelKey: "nav.postJob", href: "/client/jobs/new", icon },
  { labelKey: "nav.myProjects", href: "/client/jobs", icon },
  { labelKey: "nav.aiCopilot", href: "/client/projects", icon },
];

function activeKeys(pathname: string) {
  return buildShellNavItems({ role: "client", items: clientItems, collapsed: false, pathname, t: (key) => key })
    .filter((item) => item.active)
    .map((item) => item.labelKey);
}

test("solo un ítem queda activo: la coincidencia más específica gana", () => {
  assert.deepEqual(activeKeys("/client/jobs/new"), ["nav.postJob"]);
  assert.deepEqual(activeKeys("/client/jobs"), ["nav.myProjects"]);
  assert.deepEqual(activeKeys("/client/jobs/job_demo_005"), ["nav.myProjects"]);
  assert.deepEqual(activeKeys("/client/projects/proj_1/copilot"), ["nav.aiCopilot"]);
});

test("un prefijo que no cae en frontera de segmento no activa el ítem", () => {
  assert.deepEqual(activeKeys("/client/jobsearch"), []);
  assert.deepEqual(activeKeys("/client/otra-ruta"), []);
});
