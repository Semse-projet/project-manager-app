// Optional developer diagnostic: npm install @electric-sql/pglite@0.3.14 in an isolated runtime.
// Set CURATED_PGLITE_MODULE to its absolute dist/index.js path when installed elsewhere.
// This does not replace PostgreSQL 16 multi-connection or HTTP integration tests.
import { fileURLToPath } from 'node:url';
const { PGlite } = await import(process.env.CURATED_PGLITE_MODULE ?? '@electric-sql/pglite');
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const root = fileURLToPath(new URL('../', import.meta.url));
const sql = async name => readFile(`${root}/packages/db/prisma/migrations/${name}/migration.sql`, 'utf8');
const initial = await sql('20261019090000_curated_knowledge_f1_private_custody');
const fix = await sql('20261025090000_curated_custody_integrity');
const db = new PGlite();
const results = [];
const h='a'.repeat(64), policy='b'.repeat(64);
const q=(s,p=[])=>db.query(s,p);
const check=async(name,fn)=>{await fn();results.push(name);console.log('PASS',name)};
const rejects=async(s,params,code)=>assert.rejects(q(s,params),e=>e.code===code);
try {
await db.exec(`CREATE TABLE "Tenant" ("id" TEXT PRIMARY KEY);
CREATE TABLE "Org" ("id" TEXT PRIMARY KEY,"tenantId" TEXT NOT NULL REFERENCES "Tenant"("id"));
CREATE TABLE "User" ("id" TEXT PRIMARY KEY);
INSERT INTO "Tenant" VALUES ('t1'),('t2'); INSERT INTO "Org" VALUES ('o1','t1'),('o2','t2');
INSERT INTO "User" VALUES ('u1'),('u2');`);
await db.exec(initial);
await q(`INSERT INTO "CuratedKnowledgeEntry" (id,"tenantId","owningOrgId","createdByUserId","sourcePrivateRef","updatedAt") VALUES ('e1','t1','o1','u1','source1',now())`);
const version=async(id,num,tenant='t1')=>q(`INSERT INTO "CuratedKnowledgeVersion" (id,"tenantId","entryId",version,title,"sanitizedBody","contentSha256","createdByUserId") VALUES ($1,$2,'e1',$3,'Title','Body',$4,'u1') RETURNING *`,[id,tenant,num,h]);
const consent=async(id,actor='u1',notice='notice1')=>q(`INSERT INTO "CuratedPublicationConsent" (id,"tenantId","versionId","actorType","actorUserId",scope,purpose,"versionContentSha256","audiencePolicySha256","noticeVersion","expiresAt") VALUES ($1,'t1','v1','CONTRIBUTOR',$2,'TENANT_CURATED','RAG_REFERENCE',$3,$4,$5,now()+interval '1 day') RETURNING *`,[id,actor,h,policy,notice]);
// Demonstrate actual before-state defects before applying follow-on migration.
await version('v1',1); await version('deleted',2);
await q(`DELETE FROM "CuratedKnowledgeVersion" WHERE id='deleted'`);
await version('deleted',2);
await consent('before','u1');
await q(`UPDATE "CuratedPublicationConsent" SET "withdrawnAt"=now(),"withdrawnByUserId"='u1' WHERE id='before'`);
await q(`UPDATE "CuratedPublicationConsent" SET "withdrawnAt"=NULL,"withdrawnByUserId"=NULL WHERE id='before'`);
await consent('before-duplicate','u1'); await consent('orphan','missing');
console.log('BASELINE CONFIRMED: delete/recreate, withdrawal reset, duplicate active, orphan signer');
await check('migration rejects orphan signers atomically', async () => {
 await assert.rejects(db.exec(fix), e => e.code === '23503');
 await db.exec('ROLLBACK');
 assert.equal((await q(`SELECT to_regclass('"CuratedVersionIdentity"') AS table_name`)).rows[0].table_name, null);
});
await q(`DELETE FROM "CuratedPublicationConsent" WHERE id='orphan'`);
await check('migration rejects existing duplicate grants atomically', async () => {
 await assert.rejects(db.exec(fix), e => e.code === '23505');
 await db.exec('ROLLBACK');
 assert.equal((await q(`SELECT to_regclass('"CuratedVersionIdentity"') AS table_name`)).rows[0].table_name, null);
});
await q(`DELETE FROM "CuratedPublicationConsent"`);
await db.exec(fix);
// Use an unprivileged application role, not the table/schema owner.
await db.exec(`CREATE ROLE curated_runtime NOLOGIN NOSUPERUSER;
GRANT USAGE ON SCHEMA public TO curated_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public TO curated_runtime;
SET ROLE curated_runtime;`);
await check('historical provenance stays unknown (no fabricated backfill)', async()=>assert.equal((await q(`SELECT "sourceCapturedAt" FROM "CuratedKnowledgeVersion" WHERE id='v1'`)).rows[0].sourceCapturedAt,null));
await check('version ID and ordinal reserved after delete',async()=>{
 await q(`DELETE FROM "CuratedKnowledgeVersion" WHERE id='deleted'`);
 await assert.rejects(version('deleted',3),e=>e.code==='23505');
 await assert.rejects(version('another',2),e=>e.code==='23505');
 await version('v3',3);
});
await check('snapshot provenance immutable and new version sees new source',async()=>{
 await q(`UPDATE "CuratedKnowledgeEntry" SET "sourcePrivateRef"='source2' WHERE id='e1'`);
 assert.equal((await q(`SELECT "sourcePrivateRef" FROM "CuratedKnowledgeVersion" WHERE id='v3'`)).rows[0].sourcePrivateRef,'source1');
 assert.equal((await version('v4',4)).rows[0].sourcePrivateRef,'source2');
 await assert.rejects(q(`UPDATE "CuratedKnowledgeVersion" SET "sourcePrivateRef"='forged' WHERE id='v3'`));
});
await check('cross-tenant version denied',async()=>assert.rejects(version('cross',5,'t2'),e=>e.code==='23503'));
await check('persisted signer required',async()=>assert.rejects(consent('bad-user','missing'),e=>e.code==='23503'));
await consent('c1');
await check('active identity unique despite NULL holder and different notice',async()=>assert.rejects(consent('duplicate','u1','changed'),e=>e.code==='23505'));
await check('distinct actor allowed',async()=>{await consent('c2','u2')});
await check('all signed evidence immutable',async()=>{
 const changes=[`"actorUserId"='u2'`,`"versionId"='v3'`,`"scope"='ORG_PRIVATE'`,`"noticeVersion"='changed'`,`"proofPrivateRef"='changed'`,`"legalBasisReviewed"=true`,`"expiresAt"=now()+interval '2 days'`,`"versionContentSha256"='${policy}'`,`"audiencePolicySha256"='${h}'`,`"grantedAt"=now()-interval '1 day'`,`"rightsHolderOrgId"='o1'`,`"actorType"='RIGHTS_HOLDER'`];
 for (const c of changes) await rejects(`UPDATE "CuratedPublicationConsent" SET ${c} WHERE id='c1'`,[],'23514');
});
await check('withdrawal requires persisted withdrawing actor',async()=>rejects(`UPDATE "CuratedPublicationConsent" SET "withdrawnAt"=now(),"withdrawnByUserId"='missing' WHERE id='c1'`,[],'23503'));
await check('withdrawal pair required',async()=>rejects(`UPDATE "CuratedPublicationConsent" SET "withdrawnAt"=now() WHERE id='c1'`,[],'23514'));
await q(`UPDATE "CuratedPublicationConsent" SET "withdrawnAt"=now(),"withdrawnByUserId"='u1' WHERE id='c1'`);
await check('withdrawal irreversible; same withdrawal is idempotent',async()=>{
 await rejects(`UPDATE "CuratedPublicationConsent" SET "withdrawnAt"=NULL,"withdrawnByUserId"=NULL WHERE id='c1'`,[],'23514');
 await rejects(`UPDATE "CuratedPublicationConsent" SET "withdrawnAt"="withdrawnAt"+interval '1 second' WHERE id='c1'`,[],'23514');
 await q(`UPDATE "CuratedPublicationConsent" SET "withdrawnAt"="withdrawnAt","withdrawnByUserId"='u1' WHERE id='c1'`);
});
await check('new consent identity allowed after withdrawal',async()=>{await consent('renewal')});
await check('deleted consent ID cannot be replayed',async()=>{
 await q(`DELETE FROM "CuratedPublicationConsent" WHERE id='c1'`);
 await assert.rejects(consent('c1'),e=>e.code==='23505');
});
await check('reservations cannot be deleted, updated or truncated',async()=>{
 for (const table of ['CuratedVersionIdentity','CuratedConsentIdentity']) {
  await rejects(`DELETE FROM "${table}"`,[],'23514');
  await rejects(`UPDATE "${table}" SET id=id`,[],'23514');
  await rejects(`TRUNCATE "${table}"`,[],'23514');
 }
});
await check('private-only constraint retained',async()=>rejects(`UPDATE "CuratedKnowledgeEntry" SET status='PUBLISHED',"publicationScope"='TENANT_CURATED' WHERE id='e1'`,[],'23514'));
console.log(JSON.stringify({engine:(await q('select version()')).rows[0].version,passed:results.length,concurrency:'NOT TESTED: single embedded connection',scope:'actual two curated migrations; minimal Tenant/Org/User prerequisite tables, not full monorepo'}));
} finally { await db.close(); }
