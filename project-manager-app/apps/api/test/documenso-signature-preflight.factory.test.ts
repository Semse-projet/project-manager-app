import test from "node:test";
import assert from "node:assert/strict";
import { buildDocumensoSignaturePreflight } from "../dist/modules/contracts/documenso-signature-preflight.factory.js";

const scope={tenantId:"tenant_a",connectionId:"conn_a",contractId:"contract_a",externalRequestId:"envelope_123"};
function input(){
 return {
  prisma:{contract:{findFirst:async()=>null}},
  tenantId:"tenant_a",connectionId:"conn_a",
  instanceOrigin:"https://documenso.example/",apiToken:"api_test",
  privateEvidenceRoot:"/data/semse-private-signature-evidence",
  approvedNssTrustDirectory:"/data/documenso-nss-trust",
  consentMacKeyHex:"a".repeat(64),
  fetchImpl:async()=>{throw Error("should not call provider");},
 };
}
test("preflight factory requires explicit independent key and approved storage/CA",()=>{
 for(const patch of [
  {consentMacKeyHex:""}, {consentMacKeyHex:"untrusted"},
  {privateEvidenceRoot:""}, {approvedNssTrustDirectory:""},
  {apiToken:""},
 ]) assert.throws(()=>buildDocumensoSignaturePreflight({...input(),...patch}),
  /missing server-owned consent key/);
 assert.throws(()=>buildDocumensoSignaturePreflight({
  ...input(),instanceOrigin:"http://untrusted.example/"
 }),/pinned HTTPS origin/);
 assert.throws(()=>buildDocumensoSignaturePreflight({
  ...input(),privateEvidenceRoot:"relative"
 }),/dedicated absolute persistent mount/);
});
test("factory is dormant and never calls the network for a missing canonical contract",async()=>{
 let called=0;
 const setup=input();setup.fetchImpl=async()=>{called++;throw Error("unexpected");};
 const flow=buildDocumensoSignaturePreflight(setup);
 await assert.rejects(flow.run({
  tenantId:scope.tenantId,contractId:scope.contractId,
  connectionId:scope.connectionId,externalRequestId:scope.externalRequestId
 }),/canonical contract\/original PDF/);
 assert.equal(called,0);
});
