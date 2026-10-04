import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../..");

function read(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("authenticated layout keeps the server and first client render deterministic", () => {
  const source = read("apps/web/app/(app)/layout.tsx");

  assert.match(source, /const \[collapsed, setCollapsed\] = useState\(false\)/);
  assert.match(source, /const \[theme, setTheme\] = useState<ThemePreference>\("dark"\)/);
  assert.doesNotMatch(
    source,
    /useState\(\(\) => \{[\s\S]*?semse-sidebar-collapsed[\s\S]*?\}\)/,
  );
  assert.doesNotMatch(
    source,
    /useState\(\(\) => \{[\s\S]*?semse-theme[\s\S]*?\}\)/,
  );
});

test("shell preferences are restored after hydration and remain persistent", () => {
  const source = read("apps/web/app/(app)/layout.tsx");

  assert.match(
    source,
    /useEffect\(\(\) => \{[\s\S]*?semse-sidebar-collapsed[\s\S]*?semse-theme[\s\S]*?document\.documentElement\.dataset\.theme = savedTheme[\s\S]*?\}, \[\]\)/,
  );
  assert.match(source, /localStorage\.setItem\("semse-sidebar-collapsed", String\(next\)\)/);
  assert.match(source, /localStorage\.setItem\("semse-theme", value\)/);
});

test("client milestones renders a real empty state instead of a blank panel", () => {
  const source = read("apps/web/app/(app)/client/milestones/page.tsx");

  assert.match(source, /groups\.length === 0/);
  assert.match(source, /Aún no hay hitos de pago/);
  assert.match(source, /Los hitos aparecerán aquí/);
  assert.match(source, /href="\/client\/jobs"/);
  assert.match(source, /Ver mis proyectos/);
});
