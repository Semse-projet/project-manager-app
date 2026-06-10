import test from "node:test";
import assert from "node:assert/strict";
import { buildAdminSidebarGroups, buildShellNavItems, type ShellNavItem } from "../../apps/web/lib/navigation-shell.ts";

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

test("admin sidebar groups routes by OS instead of a flat list", () => {
  const groups = buildAdminSidebarGroups(adminItems);

  assert.deepEqual(
    groups.map((group) => group.key),
    ["mission-control", "operations", "marketplace", "governance", "ai", "system"],
  );
  assert.equal(groups.find((group) => group.key === "mission-control")?.items.length, 1);
  assert.equal(groups.find((group) => group.key === "operations")?.items.length, 1);
  assert.equal(groups.find((group) => group.key === "marketplace")?.items.length, 1);
  assert.equal(groups.find((group) => group.key === "governance")?.items.length, 1);
  assert.equal(groups.find((group) => group.key === "ai")?.items.length, 1);
  assert.equal(groups.find((group) => group.key === "system")?.items.length, 1);
});

test("admin shell nav items render grouped nodes", () => {
  const navItems = buildShellNavItems({
    role: "admin",
    items: adminItems,
    collapsed: false,
    pathname: "/admin/ops",
    t: (key) => key,
  });

  assert.equal(navItems.length, 6);
  assert.ok(navItems.every((item) => "items" in item), "grouped admin nav should expose grouped data");
  assert.equal(navItems[1].label, "os.operations");
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
