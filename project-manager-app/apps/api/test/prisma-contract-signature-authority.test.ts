import test from "node:test";
import assert from "node:assert/strict";
import {
  PrismaOriginalContractSignatureAuthority,
  PrismaStepUpConsentRepository,
} from "../dist/modules/contracts/prisma-contract-signature-authority.js";

const row = {
  id:"contract_a",canonicalPdfSha256:"a".repeat(64),
  clientUserId:"client_a",professionalUserId:"pro_a",
  clientUser:{email:"client@example.com"},
  professionalUser:{email:"pro@example.com"},
  job:{tenantId:"tenant_a"},
};
test("canonical authority scopes persisted contract to tenant and active job",async()=>{
 const calls=[];
 const prisma={
  contract:{async findFirst(query){calls.push(query);return row;}},
  signatureDispatchOutbox:{async findFirst(query){calls.push(query);return {id:"dispatch_a"};}},
 };
 const s=new PrismaOriginalContractSignatureAuthority(prisma);
 assert.equal((await s.read({tenantId:"tenant_a",contractId:"contract_a"})).canonicalPdfSha256,"a".repeat(64));
 assert.deepEqual(calls[0].where,{
  id:"contract_a",deletedAt:null,job:{tenantId:"tenant_a",deletedAt:null}
 });
 await s.assertSent({tenantId:"tenant_a",connectionId:"conn_a",contractId:"contract_a",
   providerId:"documenso",externalRequestId:"envelope_a"});
 assert.deepEqual(calls[1].where,{
  tenantId:"tenant_a",connectionId:"conn_a",contractId:"contract_a",
  providerId:"documenso",externalRequestId:"envelope_a",status:"SENT"
 });
});
test("canonical authority denies missing source hash, missing party and unowned dispatched envelope",async()=>{
 for(const invalid of [null,{...row,canonicalPdfSha256:null},
  {...row,professionalUserId:"client_a"},{...row,clientUser:{email:""}}]){
  const prisma={contract:{findFirst:async()=>invalid},signatureDispatchOutbox:{findFirst:async()=>null}};
  const s=new PrismaOriginalContractSignatureAuthority(prisma);
  await assert.rejects(s.read({tenantId:"tenant_a",contractId:"contract_a"}),
    /canonical contract\/original PDF/);
 }
 const svc=new PrismaOriginalContractSignatureAuthority({
  signatureDispatchOutbox:{findFirst:async()=>null}
 });
 await assert.rejects(svc.assertSent({tenantId:"tenant_a",connectionId:"conn_a",
  contractId:"contract_a",providerId:"documenso",externalRequestId:"envelope_a"}),
  /no sent signature dispatch/);
});
test("consent reader excludes revoked receipts and never writes consent or provenance",async()=>{
 let query;
 const prisma={
  contractSignerStepUpReceipt:{async findMany(q){query=q;return [{
    tenantId:"tenant_a",contractId:"contract_a",connectionId:"conn_a",
    providerId:"documenso",externalRequestId:"envelope_a",
    documentVersionSha256:"a".repeat(64),userId:"client_a",role:"client",
    email:"client@example.com",providerRecipientId:"1",authChallengeId:"challenge_a",
    stepUpMethod:"webauthn",identityVerifiedAt:"2026-10-09T13:00:00Z",
    consentedAt:"2026-10-09T13:01:00Z",challengeExpiresAt:"2026-10-09T13:10:00Z",
    mac:"b".repeat(64)
   }];}},
 };
 const svc=new PrismaStepUpConsentRepository(prisma);
 const result=await svc.load({tenantId:"tenant_a",contractId:"contract_a",externalRequestId:"envelope_a"});
 assert.equal(result.length,1);
 assert.equal(result[0].version,1);
 assert.equal(result[0].authChallengeId,"challenge_a");
 assert.deepEqual(query.where,{
  tenantId:"tenant_a",contractId:"contract_a",externalRequestId:"envelope_a",
  providerId:"documenso",revokedAt:null
 });
});
