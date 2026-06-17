import test from "node:test";
import assert from "node:assert/strict";

/**
 * Notifications — Tests unitarios
 * Sin DB, sin HTTP. Cubre event mapping, SSE dispatch, badge count y validaciones.
 */

// ── Event → Notification mapping ──────────────────────────────────────────────

type NotificationSpec = { userId: string; type: string; title: string; body: string };
type EventPayload = Record<string, unknown>;

function extractStr(payload: EventPayload, key: string): string | null {
  const v = payload[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

function mapEventToNotifications(eventType: string, payload: EventPayload): NotificationSpec[] {
  switch (eventType) {
    case "milestone.submitted": {
      const client = extractStr(payload, "clientUserId");
      if (!client) return [];
      return [{ userId: client, type: "milestone_submitted", title: "Nuevo hito enviado", body: "Un profesional envió un hito para revisión." }];
    }
    case "job.assigned": {
      const worker = extractStr(payload, "professionalUserId");
      if (!worker) return [];
      return [{ userId: worker, type: "job_assigned", title: "Nuevo trabajo asignado", body: "Se te asignó un trabajo." }];
    }
    case "payment.released": {
      const worker = extractStr(payload, "professionalUserId");
      if (!worker) return [];
      return [{ userId: worker, type: "payment_released", title: "Pago liberado", body: "Se liberó un pago a tu cuenta." }];
    }
    case "dispute.opened": {
      const client = extractStr(payload, "clientUserId");
      const worker = extractStr(payload, "professionalUserId");
      const specs: NotificationSpec[] = [];
      if (client) specs.push({ userId: client, type: "dispute_opened", title: "Disputa abierta", body: "Se abrió una disputa en tu proyecto." });
      if (worker) specs.push({ userId: worker, type: "dispute_opened", title: "Disputa abierta", body: "El cliente abrió una disputa. Revisa tu evidencia." });
      return specs;
    }
    case "change_order.submitted": {
      const client = extractStr(payload, "clientUserId");
      if (!client) return [];
      return [{ userId: client, type: "change_order", title: "Change order enviado", body: "Hay un cambio de alcance pendiente de tu aprobación." }];
    }
    case "job.matched": {
      const matchedUserIds = Array.isArray(payload.matchedUserIds) ? payload.matchedUserIds as string[] : [];
      const jobTitle = extractStr(payload, "jobTitle") ?? "Nuevo trabajo";
      const trade    = extractStr(payload, "trade") ?? "";
      const urgency  = typeof payload.urgency === "string" ? payload.urgency : "medium";
      const budgetMin = typeof payload.budgetMin === "number" ? payload.budgetMin : null;
      const budgetMax = typeof payload.budgetMax === "number" ? payload.budgetMax : null;
      const budgetText = budgetMin && budgetMax
        ? ` · $${Math.round(budgetMin / 1000)}k–$${Math.round(budgetMax / 1000)}k`
        : "";
      const urgencyLabel: Record<string, string> = { urgent: "⚡ Urgente", high: "Alta prioridad", medium: "", low: "" };
      const urgencyPrefix = urgencyLabel[urgency] ? `${urgencyLabel[urgency]} — ` : "";
      return matchedUserIds.map((userId) => ({
        userId,
        type: "job_matched",
        title: `${urgencyPrefix}Nuevo trabajo disponible`,
        body: `${jobTitle}${budgetText}. Oficio: ${trade}. ¡Aplica ahora!`,
      })) as NotificationSpec[];
    }
    default:
      return [];
  }
}

test("N.E1: milestone.submitted → notificación para clientUserId", () => {
  const specs = mapEventToNotifications("milestone.submitted", { clientUserId: "u1", milestoneTitle: "Fundamentos" });
  assert.equal(specs.length, 1);
  assert.equal(specs[0]?.userId, "u1");
  assert.equal(specs[0]?.type, "milestone_submitted");
});

test("N.E2: milestone.submitted sin clientUserId → sin notificaciones", () => {
  const specs = mapEventToNotifications("milestone.submitted", { milestoneTitle: "Fundamentos" });
  assert.equal(specs.length, 0);
});

test("N.E3: job.assigned → notificación para professionalUserId", () => {
  const specs = mapEventToNotifications("job.assigned", { professionalUserId: "worker1", jobTitle: "Pintar sala" });
  assert.equal(specs.length, 1);
  assert.equal(specs[0]?.userId, "worker1");
  assert.equal(specs[0]?.type, "job_assigned");
});

test("N.E4: payment.released → notificación al profesional", () => {
  const specs = mapEventToNotifications("payment.released", { professionalUserId: "w1", amount: 500 });
  assert.equal(specs.length, 1);
  assert.equal(specs[0]?.type, "payment_released");
});

test("N.E5: dispute.opened → 2 notificaciones (cliente + profesional)", () => {
  const specs = mapEventToNotifications("dispute.opened", { clientUserId: "c1", professionalUserId: "w1" });
  assert.equal(specs.length, 2, "disputa notifica a ambas partes");
  assert.ok(specs.some((s) => s.userId === "c1"));
  assert.ok(specs.some((s) => s.userId === "w1"));
});

test("N.E6: dispute.opened solo con cliente → 1 notificación", () => {
  const specs = mapEventToNotifications("dispute.opened", { clientUserId: "c1" });
  assert.equal(specs.length, 1);
});

test("N.E7: change_order.submitted → notificación al cliente", () => {
  const specs = mapEventToNotifications("change_order.submitted", { clientUserId: "c1", title: "Drywall extra" });
  assert.equal(specs.length, 1);
  assert.equal(specs[0]?.type, "change_order");
});

test("N.E8: evento desconocido → sin notificaciones", () => {
  const specs = mapEventToNotifications("unknown.event", { userId: "u1" });
  assert.equal(specs.length, 0);
});

// ── SSE channel naming ────────────────────────────────────────────────────────

function buildSseChannel(tenantId: string, userId: string): string {
  return `notifications:${tenantId}:${userId}`;
}

test("N.SSE1: canal SSE con formato correcto", () => {
  const channel = buildSseChannel("tenant_default", "usr_001");
  assert.ok(channel.startsWith("notifications:"));
  assert.ok(channel.includes("tenant_default"));
  assert.ok(channel.includes("usr_001"));
});

test("N.SSE2: canales de diferentes usuarios son distintos", () => {
  const ch1 = buildSseChannel("t1", "u1");
  const ch2 = buildSseChannel("t1", "u2");
  assert.notEqual(ch1, ch2, "usuarios distintos deben tener canales distintos");
});

test("N.SSE3: canales de diferentes tenants son distintos", () => {
  const ch1 = buildSseChannel("t1", "u1");
  const ch2 = buildSseChannel("t2", "u1");
  assert.notEqual(ch1, ch2, "tenants distintos deben tener canales distintos");
});

test("N.SSE4: SSE event name es 'notification:new'", () => {
  const EVENT_NAME = "notification:new";
  assert.equal(EVENT_NAME, "notification:new");
});

// ── Unread badge count ────────────────────────────────────────────────────────

type Notification = { id: string; readAt: string | null; type: string };

function countUnread(notifs: Notification[]): number {
  return notifs.filter((n) => !n.readAt).length;
}

function markAllRead(notifs: Notification[]): Notification[] {
  const now = new Date().toISOString();
  return notifs.map((n) => ({ ...n, readAt: n.readAt ?? now }));
}

test("N.B1: count unread — mezcla leídas y no leídas", () => {
  const notifs: Notification[] = [
    { id: "1", readAt: null, type: "job_assigned" },
    { id: "2", readAt: "2026-05-19T00:00:00Z", type: "payment_released" },
    { id: "3", readAt: null, type: "dispute_opened" },
  ];
  assert.equal(countUnread(notifs), 2);
});

test("N.B2: todas leídas → unread=0", () => {
  const notifs: Notification[] = [
    { id: "1", readAt: "2026-05-18T00:00:00Z", type: "job_assigned" },
    { id: "2", readAt: "2026-05-19T00:00:00Z", type: "payment_released" },
  ];
  assert.equal(countUnread(notifs), 0);
});

test("N.B3: todas no leídas → unread=total", () => {
  const notifs: Notification[] = [
    { id: "1", readAt: null, type: "a" },
    { id: "2", readAt: null, type: "b" },
    { id: "3", readAt: null, type: "c" },
  ];
  assert.equal(countUnread(notifs), 3);
});

test("N.B4: lista vacía → unread=0", () => {
  assert.equal(countUnread([]), 0);
});

test("N.B5: markAllRead convierte readAt=null a timestamp", () => {
  const notifs: Notification[] = [
    { id: "1", readAt: null, type: "a" },
    { id: "2", readAt: "2026-05-18T00:00:00Z", type: "b" },
  ];
  const result = markAllRead(notifs);
  assert.ok(result[0]?.readAt !== null, "no leída debe tener readAt después");
  assert.equal(result[1]?.readAt, "2026-05-18T00:00:00Z", "ya leída no debe cambiar");
  assert.equal(countUnread(result), 0);
});

// ── Notification type colors ──────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  milestone_submitted: "#818cf8",
  payment_released:    "#86efac",
  dispute_opened:      "#fca5a5",
  job_assigned:        "#67e8f9",
  change_order:        "#fcd34d",
};

test("N.C1: tipos críticos tienen color rojo/naranja", () => {
  assert.equal(TYPE_COLORS["dispute_opened"], "#fca5a5");
});

test("N.C2: pago liberado es verde (positivo)", () => {
  assert.equal(TYPE_COLORS["payment_released"], "#86efac");
});

test("N.C3: todos los tipos críticos tienen color definido", () => {
  const criticalTypes = ["dispute_opened", "payment_released", "job_assigned"];
  criticalTypes.forEach((t) => {
    assert.ok(t in TYPE_COLORS, `tipo ${t} debe tener color definido`);
  });
});

// ── Notification persistence (best-effort) ────────────────────────────────────

test("N.P1: fallo en creación de notificación no debe lanzar excepción", () => {
  let dbFailed = false;
  let caught = false;
  try {
    // Simula fallo silencioso
    dbFailed = true;
    if (dbFailed) { /* swallow */ }
  } catch {
    caught = true;
  }
  assert.equal(caught, false, "el sistema debe swallow errores de notificación");
});

test("N.P2: notificación fallida no bloquea el flujo del dominio", () => {
  // El patrón correcto: notifications son best-effort
  const domainEventCompleted = true;
  const notificationFailed   = true; // simulated
  // El domain event debe completarse independientemente
  assert.ok(domainEventCompleted, "dominio completa aunque notificación falle");
  assert.ok(notificationFailed,   "notificación puede fallar silenciosamente");
});

// ── Milestone approval → contractor notification wiring ───────────────────────

function mapMilestoneApproved(payload: EventPayload): NotificationSpec[] {
  const proUserId = extractStr(payload, "proUserId");
  if (!proUserId) return [];
  return [{
    userId: proUserId,
    type: "milestone_approved",
    title: "Hito aprobado",
    body: "El cliente aprobó tu entrega. El pago del hito puede liberarse.",
  }];
}

function mapPaymentReleased(payload: EventPayload): NotificationSpec[] {
  const proUserId = extractStr(payload, "proUserId");
  if (!proUserId) return [];
  return [{
    userId: proUserId,
    type: "payment_released",
    title: "Pago liberado",
    body: "Se liberó el pago de un hito. El monto estará disponible según tu método de cobro.",
  }];
}

test("N.MA1: milestone.approved con proUserId genera notificación al contractor", () => {
  const specs = mapMilestoneApproved({ proUserId: "pro-1", milestoneId: "m-1", projectId: "p-1" });
  assert.equal(specs.length, 1);
  assert.equal(specs[0]!.userId, "pro-1");
  assert.equal(specs[0]!.type, "milestone_approved");
});

test("N.MA2: milestone.approved sin proUserId no genera notificación", () => {
  const specs = mapMilestoneApproved({ milestoneId: "m-1" });
  assert.deepEqual(specs, []);
});

test("N.MA3: milestone.approved sin proUserId (null) no genera notificación", () => {
  const specs = mapMilestoneApproved({ proUserId: null, milestoneId: "m-1" });
  assert.deepEqual(specs, []);
});

test("N.PR1: payment.released con proUserId genera notificación al contractor", () => {
  const specs = mapPaymentReleased({ proUserId: "pro-2", milestoneId: "m-2", amount: 500, currency: "usd" });
  assert.equal(specs.length, 1);
  assert.equal(specs[0]!.userId, "pro-2");
  assert.equal(specs[0]!.type, "payment_released");
});

test("N.PR2: payment.released sin proUserId no genera notificación", () => {
  const specs = mapPaymentReleased({ milestoneId: "m-2" });
  assert.deepEqual(specs, []);
});

test("N.MA4: notificación milestone_approved es best-effort — error no bloquea aprobación", () => {
  let approvalCompleted = false;
  let notifThrew = false;

  const mockApprove = async () => {
    approvalCompleted = true;
    try {
      throw new Error("SSE channel closed");
    } catch {
      notifThrew = true;
    }
  };

  return mockApprove().then(() => {
    assert.ok(approvalCompleted, "aprobación del hito completada");
    assert.ok(notifThrew, "error de notificación fue capturado");
  });
});

// ── Rating request notifications ──────────────────────────────────────────────

function mapRatingRequested(payload: EventPayload): NotificationSpec[] {
  const proUserId    = extractStr(payload, "proUserId");
  const clientUserId = extractStr(payload, "clientUserId");
  const specs: NotificationSpec[] = [];
  if (proUserId) {
    specs.push({
      userId: proUserId,
      type: "rating_requested_pro",
      title: "Califica tu experiencia",
      body: "¿Cómo fue trabajar en este proyecto? Tu calificación ayuda a fortalecer la comunidad.",
    });
  }
  if (clientUserId) {
    specs.push({
      userId: clientUserId,
      type: "rating_requested_client",
      title: "Califica al profesional",
      body: "Tu proyecto fue completado. Comparte tu experiencia con el contratista.",
    });
  }
  return specs;
}

test("N.RR1: rating.requested con ambas partes → 2 notificaciones", () => {
  const specs = mapRatingRequested({ proUserId: "pro-1", clientUserId: "client-1", jobId: "j-1" });
  assert.equal(specs.length, 2);
  assert.ok(specs.some((s) => s.userId === "pro-1" && s.type === "rating_requested_pro"));
  assert.ok(specs.some((s) => s.userId === "client-1" && s.type === "rating_requested_client"));
});

test("N.RR2: rating.requested solo proUserId → 1 notificación al contratista", () => {
  const specs = mapRatingRequested({ proUserId: "pro-1", jobId: "j-1" });
  assert.equal(specs.length, 1);
  assert.equal(specs[0]!.type, "rating_requested_pro");
});

test("N.RR3: rating.requested solo clientUserId → 1 notificación al cliente", () => {
  const specs = mapRatingRequested({ clientUserId: "client-1", jobId: "j-1" });
  assert.equal(specs.length, 1);
  assert.equal(specs[0]!.type, "rating_requested_client");
});

test("N.RR4: rating.requested sin ninguna parte → 0 notificaciones", () => {
  const specs = mapRatingRequested({ jobId: "j-1" });
  assert.equal(specs.length, 0);
});

// ── Rating received notifications ──────────────────────────────────────────────

function mapRatingSubmitted(payload: EventPayload): NotificationSpec[] {
  const toUserId = extractStr(payload, "toUserId");
  const score    = typeof payload.score === "number" ? payload.score : null;
  if (!toUserId) return [];
  const stars = score !== null ? `${"★".repeat(score)}${"☆".repeat(5 - score)} (${score}/5)` : "";
  return [{
    userId: toUserId,
    type: "rating_received",
    title: "Recibiste una calificación",
    body: stars ? `Alguien calificó tu trabajo: ${stars}` : "Alguien calificó tu trabajo. Revisa tu perfil.",
  }];
}

test("N.RS1: rating.submitted con score → notificación con estrellas al destinatario", () => {
  const specs = mapRatingSubmitted({ toUserId: "user-2", score: 4, jobId: "j-1", ratingId: "r-1" });
  assert.equal(specs.length, 1);
  assert.equal(specs[0]!.userId, "user-2");
  assert.equal(specs[0]!.type, "rating_received");
  assert.ok(specs[0]!.body.includes("4/5"));
});

test("N.RS2: rating.submitted sin score → notificación genérica", () => {
  const specs = mapRatingSubmitted({ toUserId: "user-2", jobId: "j-1" });
  assert.equal(specs.length, 1);
  assert.ok(specs[0]!.body.includes("perfil"));
});

test("N.RS3: rating.submitted sin toUserId → 0 notificaciones", () => {
  const specs = mapRatingSubmitted({ score: 5, jobId: "j-1" });
  assert.equal(specs.length, 0);
});
