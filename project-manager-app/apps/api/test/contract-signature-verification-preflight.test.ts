import test from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { ContractSignatureVerificationPreflight } from "../dist/modules/contracts/contract-signature-verification-preflight.js";

const key=Buffer.alloc(32,17);
const original="a".repeat(64);
const pdf=Buffer.from("%PDF-1.7\nSigned example\n%%EOF");
const certificate=Buffer.from("%PDF-1.7\nCERTIFICATE\n%%EOF");
const audit=Buffer.from("%PDF-1.7\nAUDIT\n%%EOF");
const hash=(buf)=>createHash("sha256").update(buf).digest("hex");
const scope={tenantId:"tenant_a",contractId:"contract_a",connectionId:"conn_a",externalRequestId:"envelope_123"};
const contract={tenantId:"tenant_a",contractId:"contract_a",canonicalPdfSha256:original,
  clientUserId:"user_client",professionalUserId:"user_pro",
  clientEmail:"client@example.com",professionalEmail:"pro@example.com"};
const provider={status:"UNVERIFIED_PROVIDER_BYTES",externalRequestId:"envelope_123",
 signedPdf:pdf,certificate,auditLog:audit,signedPdfSha256:hash(pdf),certificateSha256:hash(certificate),
 auditLogSha256:hash(audit),recipients:[
  {id:"1",email:"client@example.com",signedAt:"2026-10-09T13:05:00Z"},
  {id:"2",email:"pro@example.com",signedAt:"2026-10-09T13:06:00Z"}]};
function receipt(role,userId,email,providerRecipientId,challenge){
 const s={version:1,...scope,providerId:"documenso",documentVersionSha256:original,
  role,userId,email,providerRecipientId,authChallengeId:challenge,stepUpMethod:"webauthn",
  identityVerifiedAt:"2026-10-09T13:00:00Z",consentedAt:"2026-10-09T13:01:00Z",
  challengeExpiresAt:"2026-10-09T13:10:00Z"};
 const mac=createHmac("sha256",key).update(JSON.stringify([
  "SEMSE_SIGNER_CONSENT_V1",s.version,s.tenantId,s.contractId,s.connectionId,s.providerId,
  s.externalRequestId,s.documentVersionSha256,s.userId,s.role,s.email,s.providerRecipientId,
  s.authChallengeId,s.stepUpMethod,s.identityVerifiedAt,s.consentedAt,s.challengeExpiresAt
 ])).digest("hex");
 return {...s,mac};
}
const receipts=[
 receipt("client","user_client","client@example.com","1","auth_c"),
 receipt("professional","user_pro","pro@example.com","2","auth_p")
];
function fixture(options={}){
 const calls=[];
 const candidate=[];
 const platform={
  authority:{
   async read(){calls.push("canonical");return options.contract??contract;},
   async assertSent(){calls.push("sent");if(options.dispatchFail)throw Error("not dispatched");},
  },
  documenso:{async download(){calls.push("download");return options.provider??provider;}},
  consents:{async load(){calls.push("stepup");return options.receipts??receipts;}},
  pdf:{async validate(bytes){calls.push("pdfsig");if(options.cryptoFail)throw Error("untrusted certificate");
    return {signatureCount:1,signedPdfSha256:hash(bytes)};}},
  artifacts:{async putImmutable(arg){calls.push("private_"+arg.kind);return "private/"+arg.kind+"/"+arg.sha256;}},
  journal:{async record(c){calls.push("journal");candidate.push(c);}},
 };
 const svc=new ContractSignatureVerificationPreflight(platform.authority,platform.documenso,
  platform.consents,key,platform.pdf,platform.artifacts,platform.journal);
 return {svc,calls,candidate};
}
test("complete cryptographic+identity+consent preflight produces ONLY pending candidate",async()=>{
 const h=fixture();const v=await h.svc.run(scope);
 assert.equal(v.status,"PENDING_VERIFICATION");
 assert.equal(v.documentVersionSha256,original);
 assert.equal(v.signedPdfSha256,hash(pdf));
 assert.equal(v.certificateSha256,hash(certificate));
 assert.equal(v.auditLogSha256,hash(audit));
 assert.deepEqual(v.signers.map(s=>s.role),["client","professional"]);
 assert.equal(h.candidate.length,1);
 assert.deepEqual(h.calls,["canonical","sent","download","stepup","pdfsig",
  "private_SIGNED_PDF","private_PROVIDER_CERTIFICATE","private_PROVIDER_AUDIT_LOG","journal"]);
 assert.equal("verifiedAt" in v,false);
});
test("forged caller hash cannot replace server-owned original document identity",async()=>{
 const h=fixture({contract:{...contract,canonicalPdfSha256:null}});
 await assert.rejects(h.svc.run(scope),/immutable canonical contract/);
 assert.deepEqual(h.calls,["canonical"]);
});
test("unowned envelope fails before any retrieval or private artifact write",async()=>{
 const h=fixture({dispatchFail:true});
 await assert.rejects(h.svc.run(scope),/not dispatched/);
 assert.deepEqual(h.calls,["canonical","sent"]);
});
test("cross-tenant contract and forged provider recipients fail closed",async()=>{
 for(const variant of [
  {contract:{...contract,tenantId:"other"}},
  {provider:{...provider,recipients:[provider.recipients[0],
    {...provider.recipients[1],email:"attacker@example.com"}]}},
  {provider:{...provider,recipients:[provider.recipients[0],provider.recipients[0]]}},
 ]){
  const h=fixture(variant);
  await assert.rejects(h.svc.run(scope),/canonical contract|provider recipient/);
  assert.equal(h.candidate.length,0);
  assert.ok(!h.calls.some(c=>c.startsWith("private_")));
 }
});
test("missing server-issued identity receipts or cryptographic trust prevents promotion",async()=>{
 for(const variant of [{receipts:[]},{receipts:[receipts[0],
   {...receipts[1],mac:"a".repeat(64)}]},{cryptoFail:true}]){
  const h=fixture(variant);
  await assert.rejects(h.svc.run(scope),/two independent|MAC invalid|untrusted certificate/);
  assert.equal(h.candidate.length,0);
  assert.ok(!h.calls.some(c=>c.startsWith("private_")));
 }
});
test("sha256 inconsistency in provider signed PDF, certificate and audit blocks journaling",async()=>{
 for(const variant of [
  {provider:{...provider,signedPdfSha256:"f".repeat(64)}},
  {provider:{...provider,certificateSha256:"f".repeat(64)}},
  {provider:{...provider,auditLogSha256:"f".repeat(64)}}
 ]){
  const h=fixture(variant);await assert.rejects(h.svc.run(scope),/artifact hash verification failed/);
  assert.equal(h.candidate.length,0);
 }
});
test("refuses duplicate identical canonical human and missing original signing intent",async()=>{
 const h=fixture({contract:{...contract,professionalUserId:"user_client"}});
 await assert.rejects(h.svc.run(scope),/distinct human/);
 assert.equal(h.candidate.length,0);
});
