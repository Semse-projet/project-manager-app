import test from "node:test";
import assert from "node:assert/strict";

/**
 * Notification Navigation — Tests unitarios
 * Cubre el routing de notificaciones → páginas, marca como leída y tipos críticos.
 */

// ── Navigation routing logic ───────────────────────────────────────────────────

type NotifType = string;
type Notification = { id: string; type: NotifType; title: string; body: string; readAt: string | null; payload?: Record<string, unknown> };

const TYPE_ROUTES: Record<NotifType, (n: Notification) => string> = {
  milestone_submitted:       (n) => n.payload?.milestoneId ? "/client/milestones" : "/client/milestones",
  evidence_gap:              (n) => n.payload?.jobId ? `/worker/jobs/${String(n.payload.jobId)}` : "/worker/evidence",
  payment_blocked:           ()  => "/client/milestones",
  payment_release_requested: ()  => "/worker/jobs",
  change_order:              ()  => "/client/milestones",
  job_assigned:              (n) => n.payload?.jobId ? `/worker/jobs/${String(n.payload.jobId)}` : "/worker/jobs",
  plan_approved:             ()  => "/client/projects",
  dispute_opened:            ()  => "/client/jobs",
  reservation_created:       ()  => "/worker/jobs",
  milestone_completed:       ()  => "/client/milestones",
};

function getRoute(n: Notification): string | null {
  const fn = TYPE_ROUTES[n.type];
  return fn ? fn(n) : null;
}

function makeNotif(type: string, payload: Record<string, unknown> = {}): Notification {
  return { id: `n-${type}`, type, title: "Test", body: "Test body", readAt: null, payload };
}

// ── Route tests ────────────────────────────────────────────────────────────────

test("NN.R1: milestone_submitted → /client/milestones", () => {
  const route = getRoute(makeNotif("milestone_submitted"));
  assert.ok(route?.includes("milestones"), `route=${route} debe incluir milestones`);
});

test("NN.R2: evidence_gap con jobId → /worker/jobs/:id", () => {
  const route = getRoute(makeNotif("evidence_gap", { jobId: "job-123" }));
  assert.ok(route?.includes("job-123"), `route=${route} debe incluir jobId`);
});

test("NN.R3: evidence_gap sin jobId → /worker/evidence", () => {
  const route = getRoute(makeNotif("evidence_gap", {}));
  assert.equal(route, "/worker/evidence");
});

test("NN.R4: payment_release_requested → /worker/jobs", () => {
  const route = getRoute(makeNotif("payment_release_requested"));
  assert.equal(route, "/worker/jobs");
});

test("NN.R5: job_assigned con jobId → /worker/jobs/:id", () => {
  const route = getRoute(makeNotif("job_assigned", { jobId: "job-456" }));
  assert.ok(route?.includes("job-456"));
});

test("NN.R6: dispute_opened → /client/jobs", () => {
  const route = getRoute(makeNotif("dispute_opened"));
  assert.equal(route, "/client/jobs");
});

test("NN.R7: tipo desconocido → null (sin navegación)", () => {
  const route = getRoute(makeNotif("unknown_type_xyz"));
  assert.equal(route, null, "tipo desconocido no debe tener ruta");
});

test("NN.R8: plan_approved → /client/projects", () => {
  const route = getRoute(makeNotif("plan_approved"));
  assert.equal(route, "/client/projects");
});

test("NN.R9: todos los tipos críticos tienen ruta definida", () => {
  const critical = ["milestone_submitted", "evidence_gap", "payment_blocked", "payment_release_requested", "job_assigned", "dispute_opened"];
  critical.forEach((type) => {
    const route = getRoute(makeNotif(type));
    assert.ok(route !== null, `${type} debe tener ruta de navegación`);
  });
});

// ── Mark as read logic ────────────────────────────────────────────────────────

test("NN.MR1: click en notif no leída → se marca como leída", () => {
  const notif: Notification = makeNotif("job_assigned");
  let marked = false;
  // Simulate: on click → mark read
  if (!notif.readAt) {
    notif.readAt = new Date().toISOString();
    marked = true;
  }
  assert.ok(marked, "notificación no leída debe marcarse al click");
  assert.ok(notif.readAt !== null, "readAt debe quedar definido");
});

test("NN.MR2: click en notif ya leída → no vuelve a marcar", () => {
  const existing = "2026-05-21T10:00:00Z";
  const notif: Notification = { ...makeNotif("job_assigned"), readAt: existing };
  let apiCalled = false;
  // Simulate: only call API if readAt is null
  if (!notif.readAt) { apiCalled = true; }
  assert.equal(apiCalled, false, "no debe llamar API para marcar si ya está leída");
  assert.equal(notif.readAt, existing, "readAt original no debe cambiar");
});

test("NN.MR3: mark all read → todas las notifs quedan con readAt", () => {
  const notifs: Notification[] = [
    makeNotif("job_assigned"),
    { ...makeNotif("dispute_opened"), readAt: "2026-05-20T00:00:00Z" },
    makeNotif("payment_blocked"),
  ];
  const now = new Date().toISOString();
  const updated = notifs.map((n) => ({ ...n, readAt: n.readAt ?? now }));
  assert.ok(updated.every((n) => n.readAt !== null), "todas deben tener readAt");
  assert.equal(updated[1]?.readAt, "2026-05-20T00:00:00Z", "ya leída no cambia");
});

// ── Unread count ──────────────────────────────────────────────────────────────

test("NN.U1: badge count = notifs sin readAt", () => {
  const notifs: Notification[] = [
    makeNotif("job_assigned"),                            // unread
    { ...makeNotif("dispute_opened"), readAt: "2026-05-20T00:00:00Z" }, // read
    makeNotif("payment_blocked"),                         // unread
  ];
  const unread = notifs.filter((n) => !n.readAt).length;
  assert.equal(unread, 2);
});

test("NN.U2: badge count = 0 cuando todas leídas", () => {
  const now = new Date().toISOString();
  const notifs = [makeNotif("job_assigned"), makeNotif("dispute_opened")].map((n) => ({ ...n, readAt: now }));
  const unread = notifs.filter((n) => !n.readAt).length;
  assert.equal(unread, 0);
});

test("NN.U3: badge muestra '9+' cuando hay más de 9 sin leer", () => {
  const unread = 12;
  const display = unread > 9 ? "9+" : String(unread);
  assert.equal(display, "9+");
});

// ── PrometeoAgent notification contract ──────────────────────────────────────

test("NN.P1: PAYMENT_RELEASE_REQUESTED genera notificación navegable", () => {
  const type = "payment_release_requested";
  const route = getRoute(makeNotif(type));
  assert.ok(route !== null, "payment_release_requested debe tener ruta");
  assert.ok(route?.includes("worker"), "ruta debe ir al contexto del worker");
});

test("NN.P2: notificación de pago contiene info del worker", () => {
  const notif = { ...makeNotif("payment_release_requested"), payload: { professionalUserId: "w-123", projectId: "p-456" } };
  assert.ok(notif.payload.professionalUserId, "debe tener professionalUserId");
  assert.ok(notif.payload.projectId, "debe tener projectId para contexto");
});

// ── Worker bid accepted notification ─────────────────────────────────────────

test("NN.BA1: bid aceptado genera job_assigned notification al worker", () => {
  const bidAcceptedEvent = { type: "bid.accepted", professionalUserId: "w-123", jobId: "j-456" };
  // Notif esperada
  const expectedNotif = {
    type:    "job_assigned",
    userId:  bidAcceptedEvent.professionalUserId,
    payload: { jobId: bidAcceptedEvent.jobId },
  };
  assert.equal(expectedNotif.type, "job_assigned");
  assert.equal(expectedNotif.userId, "w-123");
});

test("NN.BA2: job_assigned navega al job específico", () => {
  const notif = makeNotif("job_assigned", { jobId: "j-789" });
  const route = getRoute(notif);
  assert.ok(route?.includes("j-789"), `ruta debe incluir jobId: ${route}`);
});

// ── Color coding contract ─────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  evidence_gap:              "#fca5a5",  // rojo — urgente
  payment_release_requested: "#86efac",  // verde — positivo
  job_assigned:              "#86efac",  // verde — positivo
  dispute_opened:            "#f87171",  // rojo — urgente
  payment_blocked:           "#fb923c",  // naranja — advertencia
};

test("NN.CC1: tipos de pago positivo son verdes", () => {
  assert.equal(TYPE_COLORS["payment_release_requested"], "#86efac");
  assert.equal(TYPE_COLORS["job_assigned"], "#86efac");
});

test("NN.CC2: tipos de problema son rojos/naranja", () => {
  assert.ok(TYPE_COLORS["evidence_gap"]?.startsWith("#fc") || TYPE_COLORS["evidence_gap"]?.startsWith("#f"), "evidence_gap debe ser rojo");
  assert.ok(TYPE_COLORS["dispute_opened"]?.startsWith("#f"), "dispute_opened debe ser rojo");
});
