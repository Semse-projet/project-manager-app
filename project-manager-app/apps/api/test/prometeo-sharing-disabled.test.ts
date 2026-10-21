import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import { PrometeoRepository } from "../dist/modules/prometeo/prometeo.repository.js";
import { PrometeoDocumentGrantService } from "../dist/modules/prometeo/prometeo-document-grant.service.js";
import { PrometeoController } from "../dist/modules/prometeo/prometeo.controller.js";

test("default OFF forbids new grants without a DB write, and excludes shared SQL reads", async () => {
  const oldValue = process.env.SEMSE_PROMETEO_DOCUMENT_SHARING_ENABLED;
  delete process.env.SEMSE_PROMETEO_DOCUMENT_SHARING_ENABLED;
  try {
    let where: Record<string, unknown> | undefined;
    const repo = new PrometeoRepository({
      prometeoDocument: { async findMany(args: {where: Record<string,unknown>}) { where=args.where; return []; } },
    } as never);
    await repo.listDocuments({tenantId:"tenant-A",scope:{orgId:"org-A",projectIds:["project-A"],jobIds:[]}});
    assert.deepEqual(where?.OR,[
      {projectId:null,orgId:"org-A"},
      {projectId:{in:["project-A"]},orgId:"org-A"},
    ]);
    let wrote=false;
    const service=new PrometeoDocumentGrantService({
      async $transaction() { wrote=true; },
      prometeoDocument:{async findFirst(){wrote=true;}},
    } as never,{} as never);
    await assert.rejects(
      ()=>service.grant({tenantId:"tenant-A",orgId:"org-A",userId:"actor-A",roles:["CLIENT"]} as never,"doc-A","org-B","req-A"),
      (e:any)=>e.getStatus?.()===503,
    );
    assert.equal(wrote,false);
    const controller=new PrometeoController({} as never,{} as never);
    await assert.rejects(
      ()=>controller.grantDocumentAccess({headers:{}} as never,"doc-A",{recipientOrgId:"org-B"}),
      (e:any)=>e.getStatus?.()===503,
    );
  } finally {
    if(oldValue===undefined) delete process.env.SEMSE_PROMETEO_DOCUMENT_SHARING_ENABLED;
    else process.env.SEMSE_PROMETEO_DOCUMENT_SHARING_ENABLED=oldValue;
  }
});

test("only literal true activates scoped shared reads, never 1, TRUE or false", async () => {
  const oldValue=process.env.SEMSE_PROMETEO_DOCUMENT_SHARING_ENABLED;
  try {
    for(const value of ["false","TRUE","1","true"]){
      process.env.SEMSE_PROMETEO_DOCUMENT_SHARING_ENABLED=value;
      let where:Record<string,unknown>|undefined;
      const repo=new PrometeoRepository({
        prometeoDocument:{async findMany(args:{where:Record<string,unknown>}){where=args.where;return [];}},
      } as never);
      await repo.listDocuments({tenantId:"tenant-A",scope:{orgId:"org-A",projectIds:["project-A"],jobIds:[]}});
      assert.equal(
        (where?.OR as Record<string,unknown>[]).some(x=>"grants" in x),
        value==="true",
      );
    }
  } finally {
    if(oldValue===undefined)delete process.env.SEMSE_PROMETEO_DOCUMENT_SHARING_ENABLED;
    else process.env.SEMSE_PROMETEO_DOCUMENT_SHARING_ENABLED=oldValue;
  }
});
