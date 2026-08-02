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
