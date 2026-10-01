import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { PaymentsService } from "../dist/modules/payments/payments.service.js";
import { PaymentsController } from "../dist/modules/payments/payments.controller.js";
import { ReleaseAlreadyActiveError } from "../dist/modules/payments/escrow-release.command.js";

// ADR-041 slice 2a hotfix — PaymentsService.release() con PAYMENTS_RELEASE_COMMAND=on,
// con el PaymentsController real: un replay NUNCA debe devolver transaction undefined
// (toVisiblePaymentTxn(undefined) rompia el REST; el copilot lee result.transaction.id).

type Txn = { id: string; status: string; providerRef: string; milestoneId: string; amount: number; createdAt: Date };

function build(provider: { createPayoutIntent: (input: any) => Promise<any> }) {
  const txns: Txn[] = [];
  const providerCalls: any[] = [];
  const repo = {
    async ensureMilestone() { return { id: "m1", projectId: "p1", status: "APPROVED", amount: 100 }; },
    async ensureProject() { return { id: "p1", jobId: "j1" }; },
    async hasOpenDisputeForProject() { return false; },
    async findEscrowByProject() { return { id: "e1", currency: "USD" }; },
    async getDepositedAmount() { return 1000; },
    async getReleasedAmount() { return 0; },
    async getRefundedAmount() { return 0; },
    async findAcceptedProfessionalByProject() { return null; },
    async releaseFunds(r: any) {
      if (txns.some((t) => t.milestoneId === r.milestoneId && ["PENDING", "SUCCEEDED"].includes(t.status))) {
        throw new ReleaseAlreadyActiveError(r.milestoneId);
      }
      if (txns.some((t) => t.providerRef === r.providerRef)) throw Object.assign(new Error("unique"), { code: "P2002" });
      const t = { id: `txn_${txns.length + 1}`, status: "PENDING", providerRef: r.providerRef, milestoneId: r.milestoneId, amount: r.amount, createdAt: new Date() };
      txns.push(t);
      return { id: t.id };
    },
    async finalizeRelease(f: any) {
      const t = txns.find((x) => x.id === f.transactionId)!;
      if (f.status) t.status = f.status;
      if (f.providerRef) t.providerRef = f.providerRef;
      return record(t);
    },
    async findActiveRelease(milestoneId: string) {
      return txns.find((t) => t.milestoneId === milestoneId && ["PENDING", "SUCCEEDED"].includes(t.status)) ?? null;
    },
    async findReleaseByRef(ref: string) { return txns.find((t) => t.providerRef === ref) ?? null; },
    async countFailedReleaseAttempts(prefix: string) {
      return txns.filter((t) => t.status === "FAILED" && t.providerRef.startsWith(prefix)).length;
    },
    async getReleaseTransaction(id: string) { return record(txns.find((t) => t.id === id)!); },
  };
  const record = (t: Txn) => ({
    id: t.id, tenantId: "t1", escrowId: "e1", projectId: "p1", milestoneId: t.milestoneId, type: "release" as const,
    amount: t.amount, status: t.status.toLowerCase() as "pending" | "succeeded" | "failed", createdAt: t.createdAt.toISOString(),
  });
  const service = new PaymentsService(
    repo as never,
    { async append() {} } as never,
    { resolve: () => ({ createPayoutIntent: async (i: any) => { providerCalls.push(i); return provider.createPayoutIntent(i); } }) } as never,
    {} as never,
    { async findCurrentByJob() { return { id: "c1", signedClientAt: "x", signedProAt: "y" }; } } as never,
    {} as never,
    { async append() {} } as never,
  );
  const controller = new PaymentsController(service);
  return { controller, service, txns, providerCalls };
}

const req = (headers: Record<string, string> = {}) => ({
  headers: { "x-user-id": "u1", "x-tenant-id": "t1", "x-org-id": "o1", "x-roles": "OPS_ADMIN", "x-request-id": `req_${Math.random()}`, ...headers },
});

async function withFlag<T>(fn: () => Promise<T>): Promise<T> {
  const prev = process.env.PAYMENTS_RELEASE_COMMAND;
  process.env.PAYMENTS_RELEASE_COMMAND = "on";
  try { return await fn(); } finally {
    if (prev === undefined) delete process.env.PAYMENTS_RELEASE_COMMAND; else process.env.PAYMENTS_RELEASE_COMMAND = prev;
  }
}

test("REST replay (release en proceso): 2.a llamada devuelve el PaymentTxn existente, no undefined, y no transfiere otra vez", () =>
  withFlag(async () => {
    const { controller, providerCalls } = build({ createPayoutIntent: async () => ({ status: "processing", providerRef: "po_1" }) });
    const first: any = await controller.release(req() as never, "m1", {});
    assert.equal(first.data.transaction.id, "txn_1");
    const second: any = await controller.release(req() as never, "m1", {});
    assert.ok(second.data.transaction, "replay debe incluir transaction");
    assert.equal(second.data.transaction.id, "txn_1");
    assert.equal(second.data.transaction.statusRaw, "pending");
    assert.equal(second.data.replay, true);
    assert.equal(providerCalls.length, 1);
  }));

test("service replay: transaction es un PaymentTxn valido (lo lee el copilot: result.transaction.id)", () =>
  withFlag(async () => {
    const { service } = build({ createPayoutIntent: async () => ({ status: "processing", providerRef: "po_1" }) });
    const base = { tenantId: "t1", orgId: "o1", userId: "u1", roles: ["OPS_ADMIN"], milestoneId: "m1", requestId: "r" };
    await service.release({ ...base, source: "manual" });
    const agent = await service.release({ ...base, requestId: "r2", source: "agent" }); // independiente de la fuente
    assert.equal(agent.transaction.id, "txn_1");
    assert.equal(agent.replay, true);
  }));

test("misma Idempotency-Key tras rechazo definitivo: 1.a relanza el error original; 2.a => 409 failed/replay, sin otra transferencia", () =>
  withFlag(async () => {
    const { controller, providerCalls, txns } = build({
      createPayoutIntent: async () => { throw new BadRequestException("PayPal payout requires the professional payout email"); },
    });
    const h = { "idempotency-key": "key-1" };
    await assert.rejects(controller.release(req(h) as never, "m1", {}), BadRequestException);
    await assert.rejects(controller.release(req(h) as never, "m1", {}), (e: any) => {
      assert.ok(e instanceof ConflictException);
      const body = e.getResponse();
      assert.equal(body.status, "failed");
      assert.equal(body.replay, true);
      return true;
    });
    assert.equal(providerCalls.length, 1);
    assert.equal(txns.length, 1);
    assert.equal(txns[0].status, "FAILED");
    // otra clave => reintento legitimo (llama al proveedor otra vez)
    await assert.rejects(controller.release(req({ "idempotency-key": "key-2" }) as never, "m1", {}), BadRequestException);
    assert.equal(providerCalls.length, 2);
  }));

test("error de proveedor SIN senal (timeout) => 409 unknown, reserva PENDING, un reintento no vuelve a transferir", () =>
  withFlag(async () => {
    const { controller, providerCalls, txns } = build({ createPayoutIntent: async () => { throw new Error("socket hang up"); } });
    await assert.rejects(controller.release(req() as never, "m1", {}), (e: any) => {
      assert.ok(e instanceof ConflictException);
      assert.equal(e.getResponse().status, "unknown");
      return true;
    });
    assert.equal(txns[0].status, "PENDING");
    const retry: any = await controller.release(req() as never, "m1", {});
    assert.equal(retry.data.replay, true);
    assert.equal(providerCalls.length, 1);
  }));

test("con el flag apagado el camino anterior sigue igual (sin replay/command en la respuesta)", async () => {
  delete process.env.PAYMENTS_RELEASE_COMMAND;
  const { controller } = build({ createPayoutIntent: async () => ({ status: "paid", providerRef: "po_1" }) });
  // el camino legacy usa la reserva con Date.now(); basta comprobar que no entra al comando
  const res: any = await controller.release(req() as never, "m1", {});
  assert.equal(res.data.command, undefined);
  assert.ok(res.data.transaction);
});
