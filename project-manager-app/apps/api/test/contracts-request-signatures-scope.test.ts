import test from "node:test";
import assert from "node:assert/strict";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { ContractsService } from "../dist/modules/contracts/contracts.service.js";

// C51: `POST /v1/contracts/:contractId/request-signatures` (permiso contracts:create) solo exigía poder LEER el
// contrato y después enviaba solicitudes de firma a los correos del cuerpo y sobrescribía las URLs de firma.
// Ahora exige lo mismo que crear el contrato: org cliente dueña u OPS_ADMIN del tenant.

const CONTRACT = { id: "ct_1", tenantId: "t1", jobId: "job_1", clientOrgId: "org_client", professionalOrgId: "org_pro", termsJson: { parties: { projectTitle: "Obra" } } };

function build() {
  const calls: string[] = [];
  const repository = {
    // Mismo contrato que ContractsRepository.findById: otro tenant ⇒ 404; sin participación ⇒ 403.
    async findById(input: { tenantId: string; orgId: string; roles: string[]; contractId: string }) {
      calls.push(`read:${input.tenantId}`);
      if (input.tenantId !== CONTRACT.tenantId || input.contractId !== CONTRACT.id) throw new NotFoundException("nf");
      if (!input.roles.includes("OPS_ADMIN") && ![CONTRACT.clientOrgId, CONTRACT.professionalOrgId].includes(input.orgId)) {
        throw new ForbiddenException("actor cannot read this contract");
      }
      return { ...CONTRACT };
    },
    async updateSigningInfo(input: { contractId: string }) {
      calls.push(`updateSigningInfo:${input.contractId}`);
      return { ...CONTRACT };
    },
  };
  const helloSign = {
    async createSignatureRequest() {
      calls.push("helloSign.createSignatureRequest");
      return { requestId: "sr_1", signingUrlClient: "https://sign/c", signingUrlPro: "https://sign/p", embeddedEnabled: true };
    },
  };
  const audit = { append: async () => calls.push("audit") };
  return { service: new ContractsService(repository as never, audit as never, undefined, helloSign as never), calls };
}

const req = (over: Record<string, unknown> = {}) => ({
  tenantId: "t1", orgId: "org_client", userId: "u1", roles: ["CLIENT"], contractId: "ct_1", requestId: "r1",
  signers: [{ name: "A", email: "a@example.com", role: "client" as const }],
  ...over,
});

test("org cliente dueña y OPS_ADMIN del tenant pueden pedir firmas", async () => {
  for (const r of [req(), req({ orgId: "org_ops", roles: ["OPS_ADMIN"] })]) {
    const { service, calls } = build();
    const out = await service.requestSignatures(r);
    assert.equal(out.helloSignRequestId, "sr_1");
    assert.ok(calls.includes("helloSign.createSignatureRequest"));
    assert.ok(calls.includes("updateSigningInfo:ct_1"));
  }
});

test("la org profesional (puede leer) ⇒ 403 sin enviar solicitudes ni tocar las URLs de firma", async () => {
  for (const roles of [["PRO"], ["CLIENT"]]) {
    const { service, calls } = build();
    await assert.rejects(service.requestSignatures(req({ orgId: "org_pro", roles })), ForbiddenException);
    assert.ok(!calls.includes("helloSign.createSignatureRequest"));
    assert.ok(!calls.some((c) => c.startsWith("updateSigningInfo")));
  }
});

test("otra org u org vacía ⇒ 403; otro tenant ⇒ 404; nunca se envía nada", async () => {
  for (const [r, err] of [[req({ orgId: "org_other" }), ForbiddenException], [req({ orgId: "" }), ForbiddenException], [req({ tenantId: "t2" }), NotFoundException], [req({ tenantId: "t2", roles: ["OPS_ADMIN"] }), NotFoundException]] as const) {
    const { service, calls } = build();
    await assert.rejects(service.requestSignatures(r), err);
    assert.ok(!calls.includes("helloSign.createSignatureRequest"));
  }
});
