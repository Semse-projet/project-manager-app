/**
 * Tests directos de projects.policy.ts — RBAC y transiciones de ciclo de
 * vida del proyecto. Funciones puras, sin DB.
 *
 * Además de fijar el contrato de permisos, restituye la cobertura de
 * funciones de apps/api que quedó al filo del umbral (65%) cuando el
 * sanitizador público migró a @semse/schemas (PR #306).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { tsImport } from "tsx/esm/api";

type Actor = { tenantId: string; orgId: string; userId: string; roles: string[] };
type Ownership = { clientOrgId: string; assignedProOrgId: string };
type Snapshot = {
  project: { status: string; assignedProOrgId: string | null };
  ownership: Ownership;
  activeDisputes: number;
  milestoneCounts: { total: number; draft: number; submitted: number; approved: number; rejected: number; paid: number };
  escrow: { exists: boolean; totalDeposited: number; totalReleased: number; totalRefunded: number; available: number };
};

const policy = await tsImport("../src/modules/projects/projects.policy.ts", import.meta.url) as {
  canReadProject: (actor: Actor, ownership: Ownership) => boolean;
  canReadProjectFinancials: (actor: Actor, ownership: Ownership) => boolean;
  canUpdateProjectStatus: (actor: Actor, ownership: Ownership, targetStatus: string) => boolean;
  assertProjectReadable: (actor: Actor, ownership: Ownership) => void;
  assertProjectFinancialsReadable: (actor: Actor, ownership: Ownership) => void;
  assertProjectStatusUpdatable: (actor: Actor, ownership: Ownership, targetStatus: string) => void;
  assertProjectLifecycleTransition: (snapshot: Snapshot, targetStatus: string) => void;
};

const ownership: Ownership = { clientOrgId: "org_client", assignedProOrgId: "org_pro" };
const admin: Actor = { tenantId: "t1", orgId: "org_ops", userId: "u_admin", roles: ["OPS_ADMIN"] };
const client: Actor = { tenantId: "t1", orgId: "org_client", userId: "u_client", roles: ["CLIENT"] };
const pro: Actor = { tenantId: "t1", orgId: "org_pro", userId: "u_pro", roles: ["WORKER"] };
const stranger: Actor = { tenantId: "t1", orgId: "org_other", userId: "u_x", roles: ["CLIENT"] };

function snapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return {
    project: { status: "in_progress", assignedProOrgId: "org_pro" },
    ownership,
    activeDisputes: 0,
    milestoneCounts: { total: 2, draft: 0, submitted: 0, approved: 0, rejected: 0, paid: 2 },
    escrow: { exists: true, totalDeposited: 100, totalReleased: 100, totalRefunded: 0, available: 0 },
    ...overrides,
  };
}

// ── Lectura ───────────────────────────────────────────────────────────────────

test("canReadProject: admin, cliente dueño y pro asignado sí; terceros no", () => {
  assert.equal(policy.canReadProject(admin, ownership), true);
  assert.equal(policy.canReadProject(client, ownership), true);
  assert.equal(policy.canReadProject(pro, ownership), true);
  assert.equal(policy.canReadProject(stranger, ownership), false);
});

test("canReadProjectFinancials: el pro asignado NO ve balances de escrow", () => {
  assert.equal(policy.canReadProjectFinancials(admin, ownership), true);
  assert.equal(policy.canReadProjectFinancials(client, ownership), true);
  assert.equal(policy.canReadProjectFinancials(pro, ownership), false);
});

test("canUpdateProjectStatus: solo admin o cliente dueño", () => {
  assert.equal(policy.canUpdateProjectStatus(admin, ownership, "completed"), true);
  assert.equal(policy.canUpdateProjectStatus(client, ownership, "completed"), true);
  assert.equal(policy.canUpdateProjectStatus(pro, ownership, "completed"), false);
});

test("asserts lanzan Forbidden para actores sin permiso y pasan para permitidos", () => {
  policy.assertProjectReadable(client, ownership);
  policy.assertProjectFinancialsReadable(client, ownership);
  policy.assertProjectStatusUpdatable(client, ownership, "completed");
  assert.throws(() => policy.assertProjectReadable(stranger, ownership), /access/);
  assert.throws(() => policy.assertProjectFinancialsReadable(pro, ownership), /financials/);
  assert.throws(() => policy.assertProjectStatusUpdatable(pro, ownership, "completed"), /status/);
});

// ── Ciclo de vida ─────────────────────────────────────────────────────────────

test("transición al mismo estado es no-op", () => {
  policy.assertProjectLifecycleTransition(snapshot({ project: { status: "open", assignedProOrgId: null } }), "open");
});

test("open→in_progress exige pro asignado", () => {
  assert.throws(
    () => policy.assertProjectLifecycleTransition(snapshot({ project: { status: "open", assignedProOrgId: null } }), "in_progress"),
    /assigned/,
  );
  policy.assertProjectLifecycleTransition(snapshot({ project: { status: "open", assignedProOrgId: "org_pro" } }), "in_progress");
});

test("completed exige: sin disputas, con hitos y todos pagados", () => {
  assert.throws(() => policy.assertProjectLifecycleTransition(snapshot({ activeDisputes: 1 }), "completed"), /disputes/);
  assert.throws(
    () => policy.assertProjectLifecycleTransition(
      snapshot({ milestoneCounts: { total: 0, draft: 0, submitted: 0, approved: 0, rejected: 0, paid: 0 } }),
      "completed",
    ),
    /without milestones/,
  );
  assert.throws(
    () => policy.assertProjectLifecycleTransition(
      snapshot({ milestoneCounts: { total: 3, draft: 1, submitted: 0, approved: 0, rejected: 0, paid: 2 } }),
      "completed",
    ),
    /unpaid/,
  );
  policy.assertProjectLifecycleTransition(snapshot(), "completed");
});

test("cancelled bloqueado con fondos retenidos o ejecución previa", () => {
  assert.throws(
    () => policy.assertProjectLifecycleTransition(
      snapshot({ escrow: { exists: true, totalDeposited: 100, totalReleased: 0, totalRefunded: 0, available: 100 } }),
      "cancelled",
    ),
    /retains funds/,
  );
  assert.throws(
    () => policy.assertProjectLifecycleTransition(
      snapshot({ escrow: { exists: true, totalDeposited: 100, totalReleased: 50, totalRefunded: 0, available: 0 } }),
      "cancelled",
    ),
    /after execution/,
  );
  policy.assertProjectLifecycleTransition(
    snapshot({
      milestoneCounts: { total: 1, draft: 1, submitted: 0, approved: 0, rejected: 0, paid: 0 },
      escrow: { exists: false, totalDeposited: 0, totalReleased: 0, totalRefunded: 0, available: 0 },
    }),
    "cancelled",
  );
});
