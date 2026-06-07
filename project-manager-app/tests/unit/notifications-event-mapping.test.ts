/**
 * Unit tests for notification event mapping — pure logic, no DB.
 * Run: node --experimental-strip-types --test tests/unit/notifications-event-mapping.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";

// ── Inline copy of mapEventToNotifications (pure function, no NestJS deps) ───

type NotificationSpec = {
  userId: string;
  type: string;
  title: string;
  body: string;
  payload?: Record<string, unknown>;
};

type Payload = Record<string, unknown>;

function extractStr(payload: Payload, key: string): string | null {
  const value = payload[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function mapEventToNotifications(eventType: string, payload: Payload): NotificationSpec[] {
  switch (eventType) {
    case "bid.submitted": {
      const clientUserId = extractStr(payload, "clientUserId");
      if (!clientUserId) return [];
      return [{ userId: clientUserId, type: "bid_submitted", title: "Nueva propuesta recibida", body: "Un profesional envió una propuesta para tu proyecto. Revisa los detalles y compara.", payload: { jobId: payload.jobId, bidId: payload.bidId } }];
    }
    case "bid.accepted": {
      const proUserId = extractStr(payload, "proUserId");
      if (!proUserId) return [];
      return [{ userId: proUserId, type: "bid_accepted", title: "¡Tu propuesta fue aceptada!", body: "El cliente aceptó tu propuesta. Coordina el inicio del proyecto.", payload: { jobId: payload.jobId, bidId: payload.bidId } }];
    }
    case "bid.rejected": {
      const proUserId = extractStr(payload, "proUserId");
      if (!proUserId) return [];
      return [{ userId: proUserId, type: "bid_rejected", title: "Propuesta no seleccionada", body: "El cliente eligió otra propuesta. Sigue aplicando a nuevos proyectos.", payload: { jobId: payload.jobId, bidId: payload.bidId } }];
    }
    case "change-order:updated": {
      const specs: NotificationSpec[] = [];
      const status = extractStr(payload, "status");
      const clientUserId = extractStr(payload, "clientUserId");
      const proUserId = extractStr(payload, "proUserId");
      if (status === "submitted" && clientUserId) specs.push({ userId: clientUserId, type: "change_order_submitted", title: "Orden de cambio enviada", body: "El profesional propone un cambio en el alcance o costo del proyecto. Revisa y decide.", payload: { changeOrderId: payload.changeOrderId, jobId: payload.jobId } });
      else if (status === "approved" && proUserId) specs.push({ userId: proUserId, type: "change_order_approved", title: "Orden de cambio aprobada", body: "El cliente aprobó la orden de cambio. Puedes proceder con el alcance actualizado.", payload: { changeOrderId: payload.changeOrderId, jobId: payload.jobId } });
      else if (status === "rejected" && proUserId) specs.push({ userId: proUserId, type: "change_order_rejected", title: "Orden de cambio rechazada", body: "El cliente rechazó la orden de cambio. Revisa los comentarios y coordina.", payload: { changeOrderId: payload.changeOrderId, jobId: payload.jobId } });
      else if (status === "changes_requested" && proUserId) specs.push({ userId: proUserId, type: "change_order_changes_requested", title: "Se requieren ajustes", body: "El cliente solicitó cambios en tu orden antes de aprobarla.", payload: { changeOrderId: payload.changeOrderId, jobId: payload.jobId } });
      return specs;
    }
    case "job.completed": {
      const specs: NotificationSpec[] = [];
      const proUserId = extractStr(payload, "proUserId");
      const clientUserId = extractStr(payload, "clientUserId");
      if (proUserId) specs.push({ userId: proUserId, type: "job_completed", title: "Trabajo marcado como completado", body: "El trabajo fue cerrado exitosamente. Revisa tu calificación y pago final.", payload: { jobId: payload.jobId } });
      if (clientUserId) specs.push({ userId: clientUserId, type: "job_completed_client", title: "Proyecto completado", body: "Tu proyecto fue cerrado. Califica al profesional para fortalecer la plataforma.", payload: { jobId: payload.jobId } });
      return specs;
    }
    case "payment.refunded": {
      const clientUserId = extractStr(payload, "clientUserId");
      if (!clientUserId) return [];
      return [{ userId: clientUserId, type: "payment_refunded", title: "Reembolso procesado", body: "Se procesó un reembolso a tu cuenta de escrow.", payload: { jobId: payload.jobId, amount: payload.amount } }];
    }
    case "intake.converted": {
      const ownerUserId = extractStr(payload, "ownerUserId");
      if (!ownerUserId) return [];
      return [{ userId: ownerUserId, type: "intake_converted", title: "Tu solicitud se convirtió en proyecto", body: "Prometeo procesó tu solicitud y creó un proyecto. Revisa los detalles.", payload: { jobId: payload.jobId, intakeId: payload.intakeId } }];
    }
    case "governance.proposal.closed": {
      const authorUserId = extractStr(payload, "authorUserId");
      if (!authorUserId) return [];
      return [{ userId: authorUserId, type: "governance_proposal_closed", title: "Tu propuesta de gobernanza cerró", body: `La votación de tu propuesta terminó. Resultado: ${payload.result ?? "pendiente"}.`, payload: { proposalId: payload.proposalId } }];
    }
    default:
      return [];
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test("bid.submitted → notifies client", () => {
  const result = mapEventToNotifications("bid.submitted", { clientUserId: "client-1", jobId: "job-1", bidId: "bid-1" });
  assert.equal(result.length, 1);
  assert.equal(result[0].userId, "client-1");
  assert.equal(result[0].type, "bid_submitted");
});

test("bid.submitted without clientUserId → empty", () => {
  const result = mapEventToNotifications("bid.submitted", { jobId: "job-1", bidId: "bid-1" });
  assert.equal(result.length, 0);
});

test("bid.accepted → notifies pro", () => {
  const result = mapEventToNotifications("bid.accepted", { proUserId: "pro-1", jobId: "job-1", bidId: "bid-1" });
  assert.equal(result.length, 1);
  assert.equal(result[0].userId, "pro-1");
  assert.equal(result[0].type, "bid_accepted");
});

test("bid.rejected → notifies pro", () => {
  const result = mapEventToNotifications("bid.rejected", { proUserId: "pro-1", jobId: "job-1" });
  assert.equal(result.length, 1);
  assert.equal(result[0].type, "bid_rejected");
});

test("change-order:updated submitted → notifies client", () => {
  const result = mapEventToNotifications("change-order:updated", { status: "submitted", clientUserId: "client-1", changeOrderId: "co-1", jobId: "job-1" });
  assert.equal(result.length, 1);
  assert.equal(result[0].userId, "client-1");
  assert.equal(result[0].type, "change_order_submitted");
});

test("change-order:updated approved → notifies pro", () => {
  const result = mapEventToNotifications("change-order:updated", { status: "approved", proUserId: "pro-1", changeOrderId: "co-1", jobId: "job-1" });
  assert.equal(result.length, 1);
  assert.equal(result[0].userId, "pro-1");
  assert.equal(result[0].type, "change_order_approved");
});

test("change-order:updated rejected → notifies pro", () => {
  const result = mapEventToNotifications("change-order:updated", { status: "rejected", proUserId: "pro-1", changeOrderId: "co-1" });
  assert.equal(result.length, 1);
  assert.equal(result[0].type, "change_order_rejected");
});

test("change-order:updated changes_requested → notifies pro", () => {
  const result = mapEventToNotifications("change-order:updated", { status: "changes_requested", proUserId: "pro-1" });
  assert.equal(result.length, 1);
  assert.equal(result[0].type, "change_order_changes_requested");
});

test("change-order:updated unknown status → empty", () => {
  const result = mapEventToNotifications("change-order:updated", { status: "unknown" });
  assert.equal(result.length, 0);
});

test("job.completed → notifies both pro and client", () => {
  const result = mapEventToNotifications("job.completed", { proUserId: "pro-1", clientUserId: "client-1", jobId: "job-1" });
  assert.equal(result.length, 2);
  assert.ok(result.some(r => r.userId === "pro-1" && r.type === "job_completed"));
  assert.ok(result.some(r => r.userId === "client-1" && r.type === "job_completed_client"));
});

test("job.completed only pro → 1 notification", () => {
  const result = mapEventToNotifications("job.completed", { proUserId: "pro-1", jobId: "job-1" });
  assert.equal(result.length, 1);
  assert.equal(result[0].userId, "pro-1");
});

test("payment.refunded → notifies client", () => {
  const result = mapEventToNotifications("payment.refunded", { clientUserId: "client-1", jobId: "job-1", amount: 500 });
  assert.equal(result.length, 1);
  assert.equal(result[0].type, "payment_refunded");
});

test("intake.converted → notifies owner", () => {
  const result = mapEventToNotifications("intake.converted", { ownerUserId: "user-1", jobId: "job-1", intakeId: "intake-1" });
  assert.equal(result.length, 1);
  assert.equal(result[0].type, "intake_converted");
  assert.equal(result[0].userId, "user-1");
});

test("governance.proposal.closed → notifies author with result", () => {
  const result = mapEventToNotifications("governance.proposal.closed", { authorUserId: "user-1", proposalId: "prop-1", result: "passed" });
  assert.equal(result.length, 1);
  assert.equal(result[0].type, "governance_proposal_closed");
  assert.ok(result[0].body.includes("passed"));
});

test("governance.proposal.closed without authorUserId → empty", () => {
  const result = mapEventToNotifications("governance.proposal.closed", { proposalId: "prop-1" });
  assert.equal(result.length, 0);
});

test("unknown event type → empty", () => {
  const result = mapEventToNotifications("some.random.event", { userId: "user-1" });
  assert.equal(result.length, 0);
});
