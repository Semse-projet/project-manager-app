import "reflect-metadata";

import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { AgroIncidentService } from "../dist/modules/agro/agro-incident.service.js";
import { AgroFarmAccessService } from "../dist/modules/agro/agro-farm-access.service.js";
import {
  allowedIncidentTransitions, canTransitionIncident, incidentTransitionAction, incidentTransitionAuditAction,
  incidentTransitionTimestamps, suggestedSeverity,
} from "../dist/modules/agro/agro-incident.domain.js";

// ── FSM y severidad ──────────────────────────────────────────────────────────

test("agro-incident-fsm: happy path OPEN → TRIAGED → IN_PROGRESS → RESOLVED → CLOSED", () => {
  assert.equal(canTransitionIncident("OPEN", "TRIAGED"), true);
  assert.equal(canTransitionIncident("TRIAGED", "IN_PROGRESS"), true);
  assert.equal(canTransitionIncident("IN_PROGRESS", "RESOLVED"), true);
  assert.equal(canTransitionIncident("RESOLVED", "CLOSED"), true);
});

test("agro-incident-fsm: forbidden jumps and terminal states", () => {
  assert.equal(canTransitionIncident("OPEN", "CLOSED"), false);
  assert.equal(canTransitionIncident("OPEN", "RESOLVED"), false);
  assert.equal(canTransitionIncident("IN_PROGRESS", "TRIAGED"), false);
  assert.deepEqual(allowedIncidentTransitions("CANCELLED"), []);
  assert.deepEqual(allowedIncidentTransitions("DUPLICATE"), []);
  assert.equal(canTransitionIncident("OPEN", "NOPE"), false);
});

test("agro-incident-fsm: reopen is IN_PROGRESS from RESOLVED/CLOSED and needs reopen permission", () => {
  assert.equal(incidentTransitionAction("CLOSED", "IN_PROGRESS"), "incident.reopen");
  assert.equal(incidentTransitionAction("OPEN", "IN_PROGRESS"), "incident.start");
  assert.equal(incidentTransitionAuditAction("RESOLVED", "IN_PROGRESS"), "incident.reopened");
  const ts = incidentTransitionTimestamps("CLOSED", "IN_PROGRESS", new Date());
  assert.equal(ts.resolvedAt, null);
  assert.equal(ts.closedAt, null);
});

test("agro-incident-severity: suggested defaults", () => {
  assert.equal(suggestedSeverity("ANIMAL_MORTALITY"), "HIGH");
  assert.equal(suggestedSeverity("WATER_SHORTAGE"), "HIGH");
  assert.equal(suggestedSeverity("ANIMAL_INJURY"), "MEDIUM");
  assert.equal(suggestedSeverity("OTHER"), "LOW");
});

// ── Servicio ─────────────────────────────────────────────────────────────────

function setup(domainEventBus?: { emit: (event: any, ctx: any) => Promise<void> }) {
  const members = [
    { farmId: "farm_1", userId: "sup", role: "SUPERVISOR", status: "ACTIVE" },
    { farmId: "farm_1", userId: "worker", role: "WORKER", status: "ACTIVE" },
    { farmId: "farm_1", userId: "worker2", role: "WORKER", status: "ACTIVE" },
    { farmId: "farm_1", userId: "vet", role: "VETERINARIAN", status: "ACTIVE" },
  ];
  const entities: Record<string, { farmId: string }> = {
    unit_8: { farmId: "farm_1" }, grp_15: { farmId: "farm_1" }, pig_1: { farmId: "farm_1" }, grp_other: { farmId: "farm_2" },
  };
  const incidents: any[] = [];
  const audits: any[] = [];
  const evidence: any[] = [];
  let seq = 0;

  const prisma = {
    // T-052: farm_1 tiene tenant (emite agro.incident.*), farm_2 no (T-051: sin
    // tenant, sin evento cruzado — AgroAuditEvent sigue siendo el registro).
    agroFarm: { findUnique: async ({ where }: any) => (where.id === "farm_1" ? { ownerId: "owner", tenantId: "tenant_1" } : where.id === "farm_2" ? { ownerId: "other", tenantId: null } : null) },
    agroFarmMember: {
      findUnique: async ({ where }: any) =>
        members.find((m) => m.farmId === where.farmId_userId.farmId && m.userId === where.farmId_userId.userId) ?? null,
    },
  } as never;

  const repo = {
    list: async (farmId: string, f: any) => incidents.filter((i) => i.farmId === farmId && (!f.status || f.status.includes(i.status))),
    countByStatus: async (farmId: string) => incidents.filter((i) => i.farmId === farmId).map((i) => ({ status: i.status, severity: i.severity, count: 1 })),
    find: async (id: string) => incidents.find((i) => i.id === id) ?? null,
    findByClientEventId: async (farmId: string, cid: string) => incidents.find((i) => i.farmId === farmId && i.clientEventId === cid) ?? null,
    relationsBelongToFarm: async (farmId: string, ids: any) =>
      Object.entries(ids).filter(([, v]) => v).filter(([, v]) => entities[v as string]?.farmId !== farmId).map(([k]) => k),
    create: async (data: any, audit: any) => {
      const row = { id: `inc_${++seq}`, ...data };
      incidents.push(row);
      audits.push({ ...audit, entityId: row.id });
      return row;
    },
    update: async (id: string, expectedStatus: string, patch: any, a: any[]) => {
      const row = incidents.find((i) => i.id === id);
      if (!row || row.status !== expectedStatus) return null;
      Object.assign(row, patch);
      audits.push(...a);
      return { ...row };
    },
    appendAudit: async (a: any) => { audits.push(a); },
  } as never;

  const evidenceSvc = {
    recordEvidence: async (farmId: string, actorId: string, input: any) => {
      const row = { id: `ev_${++seq}`, farmId, capturedById: actorId, ...input };
      evidence.push(row);
      return row;
    },
    getEntityEvidenceForMember: async (_f: string, _t: string, id: string) => evidence.filter((e) => e.entityId === id),
  } as never;

  const tasks = {
    resolve: async (farmId: string, ref: any) => {
      if (ref.id === "task_feed_8" && farmId === "farm_1") return { source: ref.source, id: ref.id, farmId, title: "Alimentar corral 8", status: "PENDING" };
      if (ref.id === "jt_1" && ref.source === "JOB_TASK" && farmId === "farm_1") return { source: "JOB_TASK", id: "jt_1", farmId, title: "Revisar bebederos", status: "PENDING" };
      throw new NotFoundException("Task not found in farm");
    },
  } as never;

  const audit = { listForEntity: async ({ entityId }: any) => audits.filter((a) => a.entityId === entityId) } as never;
  const svc = new AgroIncidentService(repo, new AgroFarmAccessService(prisma), evidenceSvc, tasks, audit, domainEventBus as never);
  return { svc, incidents, audits, evidence };
}

const BASE = { type: "ANIMAL_INJURY", title: "Cerdito con herida en el cachete" };

test("agro-incident: worker reports incident — suggested severity, unconfirmed, OPEN, audited", async () => {
  const { svc, audits } = setup();
  const { incident, duplicate } = await svc.create("farm_1", "worker", { ...BASE, animalId: "pig_1" });
  assert.equal(duplicate, false);
  assert.equal(incident.status, "OPEN");
  assert.equal(incident.severity, "MEDIUM");
  assert.equal(incident.severityConfirmed, false);
  assert.equal(incident.reportedById, "worker");
  assert.equal(audits[0].action, "incident.created");
});

test("agro-incident: worker-provided severity stays unconfirmed; supervisor's is confirmed; Prometeo's never", async () => {
  const { svc } = setup();
  const a = await svc.create("farm_1", "worker", { ...BASE, severity: "CRITICAL" });
  assert.equal(a.incident.severity, "CRITICAL");
  assert.equal(a.incident.severityConfirmed, false);
  const b = await svc.create("farm_1", "sup", { ...BASE, severity: "HIGH" });
  assert.equal(b.incident.severityConfirmed, true);
  const c = await svc.create("farm_1", "sup", { ...BASE, severity: "HIGH", source: "PROMETEO" });
  assert.equal(c.incident.severityConfirmed, false);
});

test("agro-incident: non-member cannot report (404)", async () => {
  const { svc } = setup();
  await assert.rejects(() => svc.create("farm_1", "stranger", BASE), NotFoundException);
});

test("agro-incident: related entities must belong to the farm", async () => {
  const { svc } = setup();
  await assert.rejects(() => svc.create("farm_1", "worker", { ...BASE, animalGroupId: "grp_other" }), BadRequestException);
});

test("agro-incident: worker cannot assign or link tasks at creation", async () => {
  const { svc } = setup();
  await assert.rejects(() => svc.create("farm_1", "worker", { ...BASE, assignedToId: "worker2" }), ForbiddenException);
  await assert.rejects(() => svc.create("farm_1", "worker", { ...BASE, relatedTask: { id: "task_feed_8" } }), ForbiddenException);
});

test("agro-incident: clientEventId makes reports idempotent", async () => {
  const { svc, incidents } = setup();
  const first = await svc.create("farm_1", "worker", { ...BASE, clientEventId: "evt-1" });
  const second = await svc.create("farm_1", "worker", { ...BASE, clientEventId: "evt-1" });
  assert.equal(second.duplicate, true);
  assert.equal(second.incident.id, first.incident.id);
  assert.equal(incidents.length, 1);
});

test("agro-incident: inline evidence goes to AgroEvidenceItem(INCIDENT) and the timeline", async () => {
  const { svc, audits, evidence } = setup();
  const { incident } = await svc.create("farm_1", "worker", {
    ...BASE, evidence: [{ mediaType: "PHOTO", fileUrl: "https://example.test/p.jpg" }, { mediaType: "AUDIO", fileUrl: "https://example.test/a.m4a" }],
  });
  assert.equal(evidence.length, 2);
  assert.ok(evidence.every((e) => e.entityType === "INCIDENT" && e.entityId === incident.id));
  assert.equal(audits.filter((a) => a.action === "incident.evidence_added").length, 2);
});

test("agro-incident: supervisor triages, assigns, links JobTask; worker cannot", async () => {
  const { svc, audits } = setup();
  const { incident } = await svc.create("farm_1", "worker", BASE);
  await assert.rejects(() => svc.transition(incident.id, "worker", { to: "TRIAGED" }), ForbiddenException);
  await assert.rejects(() => svc.assign(incident.id, "worker", "worker2"), ForbiddenException);

  await svc.transition(incident.id, "sup", { to: "TRIAGED" });
  await assert.rejects(() => svc.assign(incident.id, "sup", "stranger"), BadRequestException);
  const assigned = await svc.assign(incident.id, "sup", "worker2");
  assert.equal(assigned.assignedToId, "worker2");
  const linked = await svc.linkTask(incident.id, "sup", { source: "JOB_TASK", id: "jt_1" });
  assert.equal(linked.relatedTaskSource, "JOB_TASK");
  assert.equal(linked.relatedTaskId, "jt_1");
  await assert.rejects(() => svc.linkTask(incident.id, "sup", { id: "task_elsewhere" }), NotFoundException);
  assert.deepEqual(
    audits.map((a) => a.action),
    ["incident.created", "incident.triaged", "incident.assigned", "incident.task_linked"],
  );
});

test("agro-incident: severity change by supervisor confirms and audits before/after", async () => {
  const { svc, audits } = setup();
  const { incident } = await svc.create("farm_1", "worker", BASE);
  await assert.rejects(() => svc.update(incident.id, "worker", { severity: "HIGH" }), ForbiddenException);
  const updated = await svc.update(incident.id, "sup", { severity: "HIGH", severityReason: "Herida profunda" });
  assert.equal(updated.severity, "HIGH");
  assert.equal(updated.severityConfirmed, true);
  const ev = audits.find((a) => a.action === "incident.severity_changed");
  assert.deepEqual(ev.before, { severity: "MEDIUM", severityConfirmed: false });
  assert.equal(ev.after.reason, "Herida profunda");
});

test("agro-incident: reporter may edit text of own OPEN incident but not classification", async () => {
  const { svc } = setup();
  const { incident } = await svc.create("farm_1", "worker", BASE);
  const u = await svc.update(incident.id, "worker", { description: "Sangra poco" });
  assert.equal(u.description, "Sangra poco");
  await assert.rejects(() => svc.update(incident.id, "worker2", { description: "otro" }), ForbiddenException);
  await assert.rejects(() => svc.update(incident.id, "worker", { animalGroupId: "grp_15" }), ForbiddenException);
});

test("agro-incident: assignee worker can start and resolve; resolution text required", async () => {
  const { svc } = setup();
  const { incident } = await svc.create("farm_1", "worker", BASE);
  await svc.assign(incident.id, "sup", "worker2");
  await assert.rejects(() => svc.transition(incident.id, "worker", { to: "IN_PROGRESS" }), ForbiddenException);
  await svc.transition(incident.id, "worker2", { to: "IN_PROGRESS" });
  await assert.rejects(() => svc.transition(incident.id, "worker2", { to: "RESOLVED" }), BadRequestException);
  const resolved = await svc.transition(incident.id, "worker2", { to: "RESOLVED", resolution: "Limpieza y aislamiento; veterinario avisado" });
  assert.equal(resolved.status, "RESOLVED");
  assert.ok(resolved.resolvedAt instanceof Date);
  // cerrar sigue siendo de supervisión
  await assert.rejects(() => svc.transition(incident.id, "worker2", { to: "CLOSED" }), ForbiddenException);
});

test("agro-incident: close and reopen by supervisor; invalid jumps are 409", async () => {
  const { svc, audits } = setup();
  const { incident } = await svc.create("farm_1", "worker", BASE);
  await assert.rejects(() => svc.transition(incident.id, "sup", { to: "CLOSED" }), ConflictException);
  await svc.transition(incident.id, "sup", { to: "IN_PROGRESS" });
  await svc.transition(incident.id, "sup", { to: "RESOLVED", resolution: "ok" });
  const closed = await svc.transition(incident.id, "sup", { to: "CLOSED" });
  assert.equal(closed.status, "CLOSED");
  await assert.rejects(() => svc.update(incident.id, "sup", { severity: "LOW" }), ConflictException);
  const reopened = await svc.transition(incident.id, "sup", { to: "IN_PROGRESS", reason: "Reapareció la herida" });
  assert.equal(reopened.status, "IN_PROGRESS");
  assert.equal(reopened.closedAt, null);
  assert.equal(audits.at(-1).action, "incident.reopened");
});

test("agro-incident: cancel requires reason; duplicate requires same-farm original", async () => {
  const { svc } = setup();
  const a = (await svc.create("farm_1", "worker", BASE)).incident;
  const b = (await svc.create("farm_1", "worker", BASE)).incident;
  await assert.rejects(() => svc.transition(b.id, "sup", { to: "CANCELLED" }), BadRequestException);
  await assert.rejects(() => svc.transition(b.id, "sup", { to: "DUPLICATE", duplicateOfId: b.id }), BadRequestException);
  const dup = await svc.transition(b.id, "sup", { to: "DUPLICATE", duplicateOfId: a.id });
  assert.equal(dup.duplicateOfId, a.id);
  await assert.rejects(() => svc.comment(b.id, "worker", { body: "x" }), ConflictException);
});

test("agro-incident: professional assessment only by professional roles", async () => {
  const { svc, audits } = setup();
  const { incident } = await svc.create("farm_1", "worker", BASE);
  await assert.rejects(() => svc.comment(incident.id, "sup", { body: "Evaluación", kind: "ASSESSMENT" }), ForbiddenException);
  await svc.comment(incident.id, "vet", { body: "Lesión superficial compatible con mordida; revisar en 48 h", kind: "ASSESSMENT" });
  await svc.comment(incident.id, "worker", { body: "Le puse spray cicatrizante" });
  const actions = audits.map((a) => a.action);
  assert.ok(actions.includes("incident.assessment_added"));
  assert.ok(actions.includes("incident.comment_added"));
});

test("agro-incident: optimistic concurrency — stale status yields 409", async () => {
  const { svc, incidents } = setup();
  const { incident } = await svc.create("farm_1", "worker", BASE);
  // Otro actor lo movió a TRIAGED entre lectura y escritura: simulamos leyendo y luego mutando.
  const original = (svc as any).repo.find;
  (svc as any).repo.find = async (id: string) => ({ ...(await original(id)), status: "OPEN" });
  incidents[0].status = "TRIAGED";
  await assert.rejects(() => svc.transition(incident.id, "sup", { to: "CANCELLED", reason: "x" }), ConflictException);
});

test("agro-incident: detail exposes timeline, evidence, task and viewer capabilities", async () => {
  const { svc } = setup();
  const { incident } = await svc.create("farm_1", "worker", { ...BASE, evidence: [{ mediaType: "NOTE", note: "foto pendiente" }] });
  await svc.linkTask(incident.id, "sup", { id: "task_feed_8" });
  const asWorker = await svc.get(incident.id, "worker");
  assert.equal(asWorker.evidence.length, 1);
  assert.equal(asWorker.relatedTask.title, "Alimentar corral 8");
  assert.ok(asWorker.timeline.length >= 3);
  assert.equal(asWorker.viewer.canTriage, false);
  assert.deepEqual([...asWorker.viewer.transitions], []);
  const asSup = await svc.get(incident.id, "sup");
  assert.equal(asSup.viewer.canTriage, true);
  assert.ok(asSup.viewer.transitions.includes("TRIAGED"));
});

// ── T-052: agro.incident.created/resolved (DomainEventBus) ─────────────────
// Mismo mecanismo que dispute.opened/resolved (packages/schemas/src/
// domain-events.schema.ts + DomainEventBus.emit), no el envelope v2 +
// DomainOutboxEvent. Aquí se prueba con un stub de DomainEventBus (sin cargar
// DomainEventsModule real, que arrastra Agents/AiModels/Matching/
// Notifications) — igual que el resto de este archivo prueba el servicio sin
// Nest ni Postgres reales.

function busStub() {
  const calls: Array<{ type: string; payload: any; ctx: any }> = [];
  const bus = { emit: async (event: any, ctx: any) => { calls.push({ type: event.type, payload: event.payload, ctx }); } };
  return { bus, calls };
}

test("agro-incident T-052: create() emits agro.incident.created only for a farm with tenant", async () => {
  const { bus, calls } = busStub();
  const { svc } = setup(bus);
  const { incident } = await svc.create("farm_1", "worker", BASE);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.type, "agro.incident.created");
  assert.equal(calls[0]!.payload.incidentId, incident.id);
  assert.equal(calls[0]!.payload.farmId, "farm_1");
  assert.equal(calls[0]!.payload.reportedById, "worker");
  assert.equal(calls[0]!.payload.ownerId, "owner");
  assert.equal(calls[0]!.ctx.tenantId, "tenant_1");
  assert.equal(calls[0]!.ctx.orgId, "agro:farm_1");
});

test("agro-incident T-052: transition to RESOLVED emits agro.incident.resolved with resolution text", async () => {
  const { bus, calls } = busStub();
  const { svc } = setup(bus);
  const { incident } = await svc.create("farm_1", "worker", BASE);
  await svc.transition(incident.id, "sup", { to: "IN_PROGRESS" });
  calls.length = 0; // solo el evento de la transición a RESOLVED
  await svc.transition(incident.id, "sup", { to: "RESOLVED", resolution: "Se aisló y trató al animal" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.type, "agro.incident.resolved");
  assert.equal(calls[0]!.payload.incidentId, incident.id);
  assert.equal(calls[0]!.payload.resolvedById, "sup");
  assert.equal(calls[0]!.payload.resolution, "Se aisló y trató al animal");
  assert.equal(calls[0]!.payload.reportedById, "worker");
});

test("agro-incident T-052: a non-RESOLVED transition does not emit agro.incident.resolved", async () => {
  const { bus, calls } = busStub();
  const { svc } = setup(bus);
  const { incident } = await svc.create("farm_1", "worker", BASE);
  calls.length = 0;
  await svc.transition(incident.id, "sup", { to: "TRIAGED" });
  assert.equal(calls.length, 0);
});

test("agro-incident T-052: a farm without tenant (T-051) emits no agro.incident.* — AgroAuditEvent still records it", async () => {
  const { bus, calls } = busStub();
  const { svc, audits } = setup(bus);
  const { incident } = await svc.create("farm_2", "other", BASE);
  assert.equal(calls.length, 0, "no tenant on farm_2 — DomainEventBus must not be called");
  assert.ok(audits.some((a) => a.entityId === incident.id && a.action === "incident.created"), "AgroAuditEvent still records the incident regardless of tenant");
});

test("agro-incident T-052: without a DomainEventBus at all (optional dependency), create()/transition() still work", async () => {
  const { svc } = setup(undefined);
  const { incident } = await svc.create("farm_1", "worker", BASE);
  await svc.transition(incident.id, "sup", { to: "IN_PROGRESS" });
  const resolved = await svc.transition(incident.id, "sup", { to: "RESOLVED", resolution: "ok" });
  assert.equal(resolved.status, "RESOLVED");
});
