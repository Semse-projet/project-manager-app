import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { EvidenceService } from "../dist/modules/evidence/evidence.service.js";
const input = {tenantId:"ten-test",orgId:"org-test",userId:"user-test",roles:["PRO"],
  requestId:"request-test",projectId:"project-test",key:"tenants/ten-test/evidence/canonical.jpg",kind:"PHOTO" as const};
function fixture(open: boolean) {
  const steps: string[]=[];
  const storage = {async withWriteGateMutation<T>(kind:string, fn:()=>Promise<T>):Promise<T>{
    steps.push("admit:"+kind);
    if (!open) throw Error("write gate DRAINING");
    const result=await fn();
    steps.push("settle:"+kind);
    return result;
  }};
  const repository={async create(){
    steps.push("evidence-db-create");
    return {id:"ev-test",projectId:input.projectId,jobId:null,milestoneId:null,kind:"PHOTO"};
  }};
  const audit={async append(){steps.push("audit-db");}};
  const service=new EvidenceService(repository as never,audit as never,storage as never);
  return {service,steps};
}
test("canonical EvidenceService protects creation and audit even when called directly by Smart Intake",async()=>{
  const f=fixture(true);
  const created=await f.service.register(input);
  assert.equal(created.id,"ev-test");
  assert.deepEqual(f.steps,[
    "admit:EVIDENCE_REGISTER","evidence-db-create","audit-db","settle:EVIDENCE_REGISTER",
  ]);
});
test("DRAINING prevents canonical EvidenceService registration before any DB mutation",async()=>{
  const f=fixture(false);
  await assert.rejects(()=>f.service.register(input),/DRAINING/);
  assert.deepEqual(f.steps,["admit:EVIDENCE_REGISTER"]);
});
test("register's audit failure does not claim ticket settled",async()=>{
  const steps:string[]=[];
  const service=new EvidenceService({
    async create(){steps.push("create");return {id:"ev-test",projectId:null,jobId:null,milestoneId:null,kind:"PHOTO"};}
  } as never,{async append(){steps.push("audit-failed");throw Error("audit unavailable");}} as never,{
    async withWriteGateMutation<T>(_kind:string,fn:()=>Promise<T>):Promise<T>{
      steps.push("admit");
      const result=await fn();
      steps.push("settle");
      return result;
    }
  } as never);
  await assert.rejects(()=>service.register(input),/audit unavailable/);
  assert.deepEqual(steps,["admit","create","audit-failed"]);
});
