import test from "node:test";
import assert from "node:assert/strict";
import { canReadUser, canReadUserMemberships, canRequestVerification, canVerifyUser, canUpdateUserStatus } from "../dist/modules/users/users.policy.js";
import { assertOwnsResource, assertIsOpsAdmin } from "../dist/modules/contributor-program/contributor-program.policy.js";
import { assertDomainEventEmittable } from "../dist/modules/domain-events/domain-events.policy.js";
import { projectOriginatorValidatedV1EventSchema, PROJECT_ORIGINATOR_VALIDATED_V1_SCHEMA_REF } from "@semse/schemas";
import { OriginatorService } from "../dist/modules/originator/originator.service.js";

// C51 etapa 2b — users, contributor-program, domain-events y originator NO autorizan por org: la propiedad es por
// userId (más OPS_ADMIN y tenant). Estas pruebas fijan ese contrato: compartir org NO concede acceso y una org
// vacía o ajena no cambia el resultado (ni abre ni cierra nada).

const throws = (fn: () => void) => { try { fn(); return false; } catch { return true; } };
const actor = (userId: string, orgId: string, roles: string[] = []) => ({ tenantId: "t1", userId, orgId, roles });

test("users.policy: misma org no concede lectura de otro usuario; org vacía/ajena no altera el resultado", () => {
  for (const orgId of ["org_a", "", "org_other"]) {
    assert.equal(canReadUser(actor("u1", orgId), "u1"), true, `propio, org=${orgId}`);
    assert.equal(canReadUser(actor("u1", orgId), "u2"), false, `otro usuario, org=${orgId}`);
    assert.equal(canReadUserMemberships(actor("u1", orgId), "u2"), false);
    assert.equal(canRequestVerification(actor("u1", orgId), "u2"), false);
    assert.equal(canVerifyUser(actor("u1", orgId)), false);
    assert.equal(canUpdateUserStatus(actor("u1", orgId)), false);
  }
  assert.equal(canReadUser(actor("admin", "", ["OPS_ADMIN"]), "u2"), true);
  assert.equal(canVerifyUser(actor("admin", "", ["OPS_ADMIN"])), true);
});

test("contributor-program: la propiedad es por userId; misma org u org vacía no abren recursos ajenos", () => {
  for (const orgId of ["org_a", "", "org_other"]) {
    assert.equal(throws(() => assertOwnsResource(actor("u1", orgId), "u1")), false);
    assert.equal(throws(() => assertOwnsResource(actor("u1", orgId), "u2")), true, `org=${orgId}`);
    assert.equal(throws(() => assertIsOpsAdmin(actor("u1", orgId))), true);
  }
  assert.equal(throws(() => assertOwnsResource(actor("admin", "", ["OPS_ADMIN"]), "u2")), false);
});

const event = (tenantId: string, type = "risk.flag_raised") => ({ type, meta: { tenantId, actorType: "user" } }) as never;

test("domain-events.policy: emisión manual exige OPS_ADMIN y mismo tenant (cross-tenant denegado incluso para OPS_ADMIN)", () => {
  assert.equal(throws(() => assertDomainEventEmittable({ event: event("t1"), tenantId: "t1", roles: ["OPS_ADMIN"] })), false);
  assert.equal(throws(() => assertDomainEventEmittable({ event: event("t2"), tenantId: "t1", roles: ["OPS_ADMIN"] })), true);
  assert.equal(throws(() => assertDomainEventEmittable({ event: event("t1"), tenantId: "t1", roles: [] })), true);
  assert.equal(throws(() => assertDomainEventEmittable({ event: event("t1", "job.created"), tenantId: "t1", roles: ["OPS_ADMIN"] })), true);
});

test("originator.validate: solo el creador del proyecto valida (misma org u org vacía no bastan); otro tenant => no encontrado", async () => {
  const row = { id: "po1", tenantId: "t1", projectId: "p1", status: "PENDING_OWNER_VALIDATION", originatorUserId: "uo" };
  const repository = { findById: async () => row, validate: async () => ({ ...row, status: "VALIDATED" }) };
  const prisma = { buildOpsProject: { findUnique: async () => ({ createdBy: "owner" }) } };
  const audit = { append: async () => undefined };
  const svc = new (OriginatorService as any)(repository, prisma, audit);
  const call = (tenantId: string, orgId: string, actorUserId: string) =>
    svc.validate({ tenantId, orgId, projectOriginatorId: "po1", actorUserId, decision: "VALIDATED", requestId: "r1" });
  await assert.rejects(call("t1", "org_a", "not_owner"), (e: any) => e.getResponse().code === "ORIGINATOR_VALIDATION_REQUIRES_OWNER");
  await assert.rejects(call("t1", "", "not_owner"), (e: any) => e.getResponse().code === "ORIGINATOR_VALIDATION_REQUIRES_OWNER");
  await assert.rejects(call("t2", "org_a", "owner"), (e: any) => e.getResponse().code === "ORIGINATOR_NOT_FOUND");
  await assert.doesNotReject(call("t1", "org_a", "owner")); // el dueño valida; la org solo se registra en auditoría/evento
});

test("originator: una org vacía no pasa el esquema real del evento de validación (el repositorio real la rechazaría)", () => {
  const base = {
    eventId: crypto.randomUUID(), eventType: "project.originator_validated.v1", version: 1, envelopeVersion: 2,
    occurredAt: new Date().toISOString(), recordedAt: new Date().toISOString(), tenantId: "t1",
    module: "originator", entityType: "ProjectOriginator", entityId: "po1", actor: { type: "user", id: "owner" },
    correlationId: "r1", idempotencyKey: "k1", schemaRef: PROJECT_ORIGINATOR_VALIDATED_V1_SCHEMA_REF,
    payload: { projectOriginatorId: "po1", projectId: "p1", originatorUserId: "uo", decision: "VALIDATED" },
    metadata: { source: "originator.validate" },
  };
  assert.equal(projectOriginatorValidatedV1EventSchema.safeParse({ ...base, orgId: "org_a" }).success, true);
  assert.equal(projectOriginatorValidatedV1EventSchema.safeParse({ ...base, orgId: "" }).success, false);
});
