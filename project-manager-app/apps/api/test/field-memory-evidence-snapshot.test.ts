import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { readFrozenEvidenceProjection } from "../dist/infrastructure/storage/field-memory-evidence-snapshot.js";

const scope="storage:/tmp/semse-t008-private";
const checksum="a".repeat(64);
const env={NODE_ENV:"test",SEMSE_STORAGE_WRITE_GATE_MODE:"staging",SEMSE_STORAGE_ROOT:"/tmp/semse-t008-private",CI:"true",DATABASE_URL:"postgresql://semse:synthetic@127.0.0.1:5433/semse"};
const row={id:"ev-synthetic",tenantId:"tenant-synthetic",projectId:"project-synthetic",
  bucketKey:"tenants/tenant-synthetic/public-intake/evidence/example.jpg",
  checksum,projectTenantId:"tenant-synthetic"};
function dbFixture(options: {
  phase?: string; epoch?: bigint;coverageDigest?:string|null; active?:bigint;
  audit?: boolean; evidence?:typeof row[]; 
}={}) {
  const queries:string[]=[];
  let isolation:unknown;
  const prisma={
    async $transaction(work:(tx:unknown)=>Promise<unknown>,settings:{isolationLevel:unknown}) {
      isolation=settings.isolationLevel;
      return work({
        async $queryRaw(strings:TemplateStringsArray,..._values:unknown[]) {
          const query=strings.join(" ");
          queries.push(query);
          if(query.includes('FROM "StorageWriteGate"')) return [{
            phase:options.phase??"FROZEN", epoch:options.epoch??2n,
            coverageDigest:options.coverageDigest===undefined?checksum:options.coverageDigest,
          }];
          if(query.includes('FROM "StorageWriteOperation"')) return [{count:options.active??0n}];
          if(query.includes('FROM "StorageWriteGateAudit"')) return options.audit===false?[]:[{id:"audit-synthetic"}];
          if(query.includes('FROM "Evidence"')) return options.evidence??[row];
          throw Error("Unexpected SQL query in synthetic fixture");
        },
      });
    },
  };
  return {prisma,queries,getIsolation:()=>isolation};
}
const params=(envOverrides:Record<string,string>={})=>({
  scope,expectedEpoch:2n,env:{...env,...envOverrides},
});

test("FROZEN Evidence projection comes from one repeatable-read transaction, still not accepted as a backup",async()=>{
  const f=dbFixture();
  const value=await readFrozenEvidenceProjection(f.prisma as never,params());
  assert.equal(f.getIsolation(),Prisma.TransactionIsolationLevel.RepeatableRead);
  assert.equal(value.status,"DB_PROJECTION_ONLY");
  assert.equal(value.privateProjection.schema,"semse-evidence-backup-projection-v1");
  assert.equal(value.recordCount,1);
  assert.equal(value.coverageDigest,checksum);
  assert.match(value.projectionDigest,/^[a-f0-9]{64}$/);
  assert.equal(value.databaseTransactionConsistent,true);
  assert.equal(value.filesystemSnapshotConsistent,false);
  assert.equal(value.checksumAuthorityVerified,false);
  assert.equal(value.restoreVerified,false);
  assert.equal(value.captureSessionActivationPermitted,false);
  assert.deepEqual(value.violations,{
    missingChecksum:0,unsafeOrLegacyKey:0,tenantMismatch:0,duplicateKey:0,missingOrCrossTenantProject:0,
  });
  assert.equal(f.queries.length,4);
  assert.match(f.queries[0]! ,/FOR SHARE/);
});

test("OPEN or DRAINING gate cannot export an Evidence projection",async()=>{
  for(const phase of ["OPEN","DRAINING"]) {
    const f=dbFixture({phase});
    await assert.rejects(()=>readFrozenEvidenceProjection(f.prisma as never,params()),
      (e:unknown)=>(e as {reason?:string}).reason==="checkpoint_requires_audited_frozen_gate");
    assert.equal(f.queries.length,1);
  }
});

test("missing coverage, freeze audit, or active writer fails closed before reading private Evidence",async()=>{
  const cases=[
    {options:{coverageDigest:null},reason:"checkpoint_requires_audited_frozen_gate"},
    {options:{audit:false},reason:"checkpoint_missing_freeze_audit"},
    {options:{active:1n},reason:"checkpoint_active_writers"},
    {options:{epoch:3n},reason:"checkpoint_requires_audited_frozen_gate"},
  ];
  for(const c of cases){
    const f=dbFixture(c.options);
    await assert.rejects(()=>readFrozenEvidenceProjection(f.prisma as never,params()),
      (e:unknown)=>(e as {reason?:string}).reason===c.reason);
    assert.equal(f.queries.some(s=>s.includes('FROM "Evidence"')),false);
  }
});

test("checksum gaps, tenant mismatch, duplicate keys and cross-tenant projects never become valid backups",async()=>{
  const f=dbFixture({evidence:[
    {...row,id:"ev1",checksum:null},
    {...row,id:"ev2",tenantId:"other-tenant",projectTenantId:"wrong"},
    {...row,id:"ev3",bucketKey:"evidence/legacy.jpg",projectTenantId:"tenant-synthetic"},
  ]});
  const v=await readFrozenEvidenceProjection(f.prisma as never,params());
  assert.equal(v.status,"BLOCKED_INCOMPLETE_EVIDENCE");
  assert.equal(v.violations.missingChecksum,1);
  assert.equal(v.violations.tenantMismatch,1);
  assert.equal(v.violations.duplicateKey,1);
  assert.equal(v.violations.unsafeOrLegacyKey,1);
  assert.equal(v.violations.missingOrCrossTenantProject,1);
  assert.equal(v.captureSessionActivationPermitted,false);
});

test("ambiguous Evidence keys are blocked before offline reconciliation",async()=>{
  const invalid=[
    "tenants/tenant-synthetic/evidence//doubled.jpg",
    "tenants/tenant-synthetic/evidence/./normalized.jpg",
    "tenants/tenant-synthetic/evidence/../escape.jpg",
    "/tenants/tenant-synthetic/evidence/absolute.jpg",
    "tenants/tenant-synthetic/evidence/",
    "tenants/tenant-synthetic/evidence/" + "x".repeat(512),
    "tenants/tenant-synthetic/evidence\\backslash.jpg",
  ];
  const rows=invalid.map((key,index)=>({...row,id:"invalid"+index,bucketKey:key}));
  const candidate=await readFrozenEvidenceProjection(dbFixture({evidence:rows}).prisma as never,params());
  assert.equal(candidate.status,"BLOCKED_INCOMPLETE_EVIDENCE");
  assert.equal(candidate.violations.unsafeOrLegacyKey,invalid.length);
  assert.equal(candidate.captureSessionActivationPermitted,false);
});

test("empty Evidence snapshot remains BLOCKED, rather than returning a false custody PASS",async()=>{
  const v=await readFrozenEvidenceProjection(dbFixture({evidence:[]}).prisma as never,params());
  assert.equal(v.status,"BLOCKED_INCOMPLETE_EVIDENCE");
  assert.equal(v.recordCount,0);
});

test("production marker and missing staging opt-in deny before any PostgreSQL query",async()=>{
  for(const e of [
    {NODE_ENV:"production",SEMSE_STORAGE_WRITE_GATE_MODE:"staging"},
    {RAILWAY_ENVIRONMENT:"production",SEMSE_STORAGE_WRITE_GATE_MODE:"staging"},
    {RAILWAY_ENVIRONMENT_NAME:"production",SEMSE_STORAGE_WRITE_GATE_MODE:"staging"},
    {NODE_ENV:"test",SEMSE_STORAGE_WRITE_GATE_MODE:"off"},
    {NODE_ENV:"test",SEMSE_STORAGE_WRITE_GATE_MODE:"staging",RAILWAY_PROJECT_ID:"95ad1b14-d1d9-467d-82d8-5354619ba873"},
    {NODE_ENV:"test",SEMSE_STORAGE_WRITE_GATE_MODE:"staging",RAILWAY_ENVIRONMENT_ID:"d682210a-956a-4508-9c5b-4ca5959278f9"},
  ]) {
    const f=dbFixture();
    await assert.rejects(()=>readFrozenEvidenceProjection(f.prisma as never,{
      scope,expectedEpoch:2n,env:{...env,...e},
    }), (error:unknown)=>(error as {status?:number}).status===503);
    assert.equal(f.queries.length,0);
  }
});

test("local CI database identity and explicit staging project are mandatory",async()=>{
  for(const overrides of [
    {CI:"false"},
    {CI:"true",DATABASE_URL:"postgresql://semse:test@db.production:5432/semse"},
    {CI:"true",DATABASE_URL:"postgresql://semse:test@127.0.0.1:5433/other"},
  ]){
    const f=dbFixture();
    await assert.rejects(()=>readFrozenEvidenceProjection(f.prisma as never,{
      scope,expectedEpoch:2n,env:{...env,...overrides},
    }), (e:unknown)=>(e as {status?:number}).status===503);
    assert.equal(f.queries.length,0);
  }
  // Naming a Railway environment "staging" does NOT independently prove
  // its DB URL was never copied from the production service. Fail closed.
  const stage=dbFixture();
  await assert.rejects(()=>readFrozenEvidenceProjection(stage.prisma as never,{
    scope,expectedEpoch:2n,
    env:{NODE_ENV:"test",SEMSE_STORAGE_WRITE_GATE_MODE:"staging",
      SEMSE_STORAGE_ROOT:"/tmp/semse-t008-private",
      RAILWAY_PROJECT_ID:"different-ci-staging-project",
      RAILWAY_ENVIRONMENT_NAME:"staging"},
  }),(e:unknown)=>(e as {status?:number}).status===503);
  assert.equal(stage.queries.length,0);
});

test("invalid scope or epoch is rejected before reading any private row",async()=>{
  const f=dbFixture();
  await assert.rejects(()=>readFrozenEvidenceProjection(f.prisma as never,{
    scope:"storage:../../escape",expectedEpoch:2n,env,
  }));
  await assert.rejects(()=>readFrozenEvidenceProjection(f.prisma as never,{
    scope,expectedEpoch:0n,env,
  }));
  await assert.rejects(()=>readFrozenEvidenceProjection(f.prisma as never,{
    scope,expectedEpoch:2n,env:{...env,SEMSE_STORAGE_ROOT:"/tmp/other-scope"},
  }));
  assert.equal(f.queries.length,0);
});
