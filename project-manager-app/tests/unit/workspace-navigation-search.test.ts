import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { navigationRegistry, type NavigationNode } from "../../apps/web/lib/navigation-registry.ts";
import type { WorkspaceRole } from "../../apps/web/app/workspace/lib/workspace-model.ts";

// Next.js resolves extensionless imports; Node's strip-types runner needs this
// narrowly scoped resolver. The tests execute the real helper, not a replica.
const registryUrl = new URL("../../apps/web/lib/navigation-registry.ts", import.meta.url).href;
const resolver = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "../../../lib/navigation-registry") {
      return nextResolve(registryUrl, context);
    }
    return nextResolve(specifier, context);
  },
});
const { getWorkspaceDestinations, filterWorkspaceDestinations } = await import(
  "../../apps/web/app/workspace/lib/workspace-navigation.ts"
).finally(() => resolver.deregister());

const roles: WorkspaceRole[] = ["worker", "client", "admin"];
const dictionarySource = readFileSync(
  new URL("../../apps/web/lib/language-context.tsx", import.meta.url),
  "utf8",
);
const esStart = dictionarySource.indexOf("  es: {");
const enStart = dictionarySource.indexOf("  en: {", esStart);
assert.ok(esStart >= 0 && enStart > esStart, "Debe existir el catálogo local ES antes de EN");
const spanishLabels = Object.fromEntries(
  [...dictionarySource.slice(esStart, enStart).matchAll(/"(nav\.[^"\n]+)":\s*("(?:[^"\\]|\\.)*")/g)]
    .map((match) => [match[1], JSON.parse(match[2]) as string]),
);

function fixture(overrides: Partial<NavigationNode> = {}): NavigationNode {
  return {
    id: "synthetic-active",
    labelKey: "nav.settings",
    canonicalHref: "/synthetic/navigation",
    legacyHrefs: ["/synthetic/legacy"],
    layer: "workspace",
    os: "system",
    roles: ["admin"],
    owner: "unit-test",
    status: "active",
    ...overrides,
  };
}

test("P2-N1: rol nulo o desconocido falla cerrado, incluso con búsqueda", () => {
  for (const role of [null, "OPS_ADMIN", "guest", "", undefined]) {
    assert.deepEqual(getWorkspaceDestinations(role as WorkspaceRole | null), []);
    assert.deepEqual(getWorkspaceDestinations(role as WorkspaceRole | null, "configuracion"), []);
    assert.deepEqual(filterWorkspaceDestinations([fixture()], role as WorkspaceRole | null), []);
  }
});

for (const role of roles) {
  test(`P2-H1 ${role}: todos los destinos activos autorizados conservan IDs y referencias canónicas`, () => {
    const expected = navigationRegistry.filter((node) => node.status === "active" && node.roles.includes(role));
    const destinations = getWorkspaceDestinations(role);
    assert.ok(destinations.length > 0);
    assert.deepEqual(destinations.map(({ id }) => id), expected.map(({ id }) => id));
    assert.equal(new Set(destinations.map(({ href }) => href)).size, destinations.length);
    for (const destination of destinations) {
      const node = expected.find(({ id }) => id === destination.id)!;
      assert.equal(destination.href, node.canonicalHref);
      assert.equal(destination.label, spanishLabels[node.labelKey], `${node.id} debe usar la traducción ES vigente`);
      assert.deepEqual(Object.keys(destination).sort(), ["href", "id", "label"]);
      assert.ok(!destination.label.startsWith("nav."));
      assert.ok(!destination.href.startsWith("/api/"));
      assert.ok(!node.legacyHrefs?.includes(destination.href));
    }
  });
}

test("P2-N2: admin no hereda enlaces exclusivos de cliente/profesional", () => {
  const adminIds = getWorkspaceDestinations("admin").map(({ id }) => id);
  assert.ok(!adminIds.includes("worker-jobs"));
  assert.ok(!adminIds.includes("client-my-projects"));
  assert.ok(!adminIds.includes("worker-settings"));
  assert.ok(adminIds.includes("ops-buildops"));
  assert.ok(getWorkspaceDestinations("worker").some(({ id }) => id === "ops-buildops"));
  assert.ok(!getWorkspaceDestinations("client").some(({ id }) => id === "ops-buildops"));
  for (const role of roles) {
    assert.ok(getWorkspaceDestinations(role).some(({ id }) => id === "governance-proposals"));
  }
});

test("P2-N3: los nodos planned reales nunca se exponen ni por búsqueda", () => {
  const planned = navigationRegistry.filter(({ status }) => status === "planned");
  assert.ok(planned.length > 0);
  for (const role of roles) {
    for (const query of [undefined, "operaciones", "gobernanza", "marketplace", "risk"]) {
      const ids = getWorkspaceDestinations(role, query).map(({ id }) => id);
      assert.ok(planned.every(({ id }) => !ids.includes(id)));
    }
  }
});

test("P2-N4: filtra planned/alias/deprecated, API y enlaces ajenos antes de buscar", () => {
  const nodes = [
    fixture(),
    fixture({ id: "planned", status: "planned", canonicalHref: "/synthetic/planned" }),
    fixture({ id: "alias", status: "alias", canonicalHref: "/synthetic/alias" }),
    fixture({ id: "deprecated", status: "deprecated", canonicalHref: "/synthetic/deprecated" }),
    fixture({ id: "other-role", roles: ["client"], canonicalHref: "/synthetic/client" }),
    ...["/api", "/api/semse/workspace", "/api?query=1", "/api#anchor", "https://example.test", "//example.test", "javascript:alert(1)"].map(
      (canonicalHref, index) => fixture({ id: `invalid-link-${index}`, canonicalHref }),
    ),
  ];
  for (const query of [undefined, "CONFIGURACION"]) {
    assert.deepEqual(filterWorkspaceDestinations(nodes, "admin", query), [
      { id: "synthetic-active", label: "Configuración", href: "/synthetic/navigation" },
    ]);
  }
});

test("P2-E1: elimina href duplicados sin ocultar el primer nodo autorizado", () => {
  const nodes = [
    fixture({ id: "forbidden-first", roles: ["client"] }),
    fixture({ id: "planned-first", status: "planned" }),
    fixture({ id: "first-active" }),
    fixture({ id: "duplicate-active" }),
    fixture({ id: "different-href", canonicalHref: "/synthetic/other" }),
  ];
  assert.deepEqual(filterWorkspaceDestinations(nodes, "admin").map(({ id }) => id), ["first-active", "different-href"]);
});

test("P2-E2: búsqueda ES por etiqueta ignora mayúsculas, acentos y espacios externos", () => {
  const expected = [{ id: "admin-settings", label: "Configuración", href: "/admin/settings" }];
  for (const query of ["configuracion", "CONFIGURACIÓN", "  Configuracio\u0301n  ", "FIGURACIO"]) {
    assert.deepEqual(getWorkspaceDestinations("admin", query), expected);
  }
  assert.deepEqual(getWorkspaceDestinations("client", "RESENAS"), [
    { id: "client-reviews", label: "Reseñas", href: "/client/reviews" },
  ]);
});

test("P2-N5: busca únicamente label y jamás amplía los roles permitidos", () => {
  assert.deepEqual(getWorkspaceDestinations("admin", "Mis trabajos"), []);
  assert.deepEqual(getWorkspaceDestinations("worker", "Mis proyectos"), []);
  assert.deepEqual(getWorkspaceDestinations("client", "Configuración"), []);
  assert.deepEqual(getWorkspaceDestinations("admin", "/admin/settings"), []);
  assert.deepEqual(getWorkspaceDestinations("admin", "admin-settings"), []);
  assert.deepEqual(getWorkspaceDestinations("admin", "nav.settings"), []);
  assert.deepEqual(getWorkspaceDestinations("admin", "sin-coincidencias-☃"), []);
});

test("P2-E3: búsqueda vacía conserva orden; los resultados no mutan el registro", () => {
  const before = structuredClone(navigationRegistry);
  for (const role of roles) {
    assert.deepEqual(getWorkspaceDestinations(role, " \t\n "), getWorkspaceDestinations(role));
  }
  const destinations = getWorkspaceDestinations("admin");
  destinations[0].href = "/synthetic/not-canonical";
  destinations[0].label = "Mutación de prueba";
  destinations.splice(1);
  assert.deepEqual(navigationRegistry, before);
  assert.notEqual(getWorkspaceDestinations("admin")[0].href, destinations[0].href);
});

test("P2-N6: una clave sin traducción ES falla cerrada en vez de mostrar texto crudo", () => {
  assert.deepEqual(filterWorkspaceDestinations([fixture({ labelKey: "nav.syntheticMissing" })], "admin"), []);
});
