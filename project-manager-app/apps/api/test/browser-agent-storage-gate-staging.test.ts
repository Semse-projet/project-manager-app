import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { BrowserAgentService } from "../dist/modules/browser-agent/browser-agent.service.js";

const actor = {tenantId:"ten-synthetic",orgId:"org-synthetic",userId:"worker-synthetic",roles:["PRO"]};
const result = {url:"https://example.org",finalUrl:"https://example.org",
  title:"Synthetic page",status:200,severity:"low",loadTimeMs:20,consoleErrors:[],networkFailures:[]};
const aiSummary = {summary_es:"Sintético"};
type Save = {saveAsEvidence:(projectId:string,milestoneId:string|undefined,actor:typeof actor,
  result:typeof result,summary:typeof aiSummary)=>Promise<void>};

function fixture(open: boolean) {
  const calls: string[] = [];
  const gateway = {uploadEvidence:async (input:{bucketKey:string})=>{
    calls.push("register");
    assert.match(input.bucketKey,/tenants\/ten-synthetic/);
  }};
  const storage = {
    withWriteGateMutation:async (kind:string,work:()=>Promise<unknown>)=>{
      calls.push("admit:"+kind);
      if(!open) throw Error("not open");
      const res=await work();
      calls.push("settle:"+kind);
      return res;
    },
    store:async ()=>{calls.push("store");},
  };
  const service = new BrowserAgentService({} as never,{} as never,{} as never,gateway as never,storage as never);
  return {calls,save:(service as unknown as Save).saveAsEvidence.bind(service)};
}
test("Browser Agent holds BROWSER_EVIDENCE ticket through store AND gateway registration",async()=>{
  const f=fixture(true);
  await f.save("project-synthetic",undefined,actor,result,aiSummary);
  assert.deepEqual(f.calls,["admit:BROWSER_EVIDENCE","store","register","settle:BROWSER_EVIDENCE"]);
});
test("DRAINING denies Browser Agent before any bytes or Evidence registration",async()=>{
  const f=fixture(false);
  await assert.rejects(()=>f.save("project-synthetic",undefined,actor,result,aiSummary),/not open/);
  assert.deepEqual(f.calls,["admit:BROWSER_EVIDENCE"]);
});
