import 'reflect-metadata';
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';

const dbTest=process.env.DATABASE_URL?test:test.skip;
dbTest('BO-05 real PostgreSQL: verified owner, tenant FK, concurrent provisioning and atomic audit rollback',async()=>{
 const {PrismaService}=await import('../dist/infrastructure/prisma/prisma.service.js');
 const {OffersService}=await import('../dist/modules/organizations/offers.service.js');
 const {AuditService}=await import('../dist/infrastructure/audit/audit.service.js');
 const prisma=new PrismaService({getOrThrow:(key:string)=>process.env[key]} as never);
 const uid=(prefix:string)=>prefix+'_'+randomUUID();
 const tenantId=uid('bo05_t'),foreignTenantId=uid('bo05_other');const orgId=uid('bo05_o');
 const ownerId=uid('bo05_owner'),otherId=uid('bo05_client'),opsId=uid('bo05_ops'),workerId=uid('bo05_worker');
 const userIds=[ownerId,otherId,opsId,workerId];const tenantIds=[tenantId,foreignTenantId];let failAudit=false;
 const realAudit=new AuditService(prisma,{} as never);
 const audit={append:async(entry:any,tx:any)=>{assert.ok(tx);await realAudit.append(entry,tx);if(failAudit)throw Error('injected audit failure');}};
 const service=new OffersService(prisma,audit as never);
 const previous=process.env.SEMSE_BUSINESS_OFFERS_ENABLED;process.env.SEMSE_BUSINESS_OFFERS_ENABLED='true';
 await prisma.$connect();
 try{
  await prisma.tenant.createMany({data:tenantIds.map(id=>({id,slug:id,name:'Synthetic BO05 test'}))});
  await prisma.org.create({data:{id:orgId,tenantId,type:'CLIENT',name:'Synthetic BO05 test'}});
  await prisma.user.createMany({data:userIds.map(id=>({id,email:id+'@example.invalid'}))});
  for(const [id,key]of [[ownerId,'CLIENT'],[otherId,'CLIENT'],[opsId,'OPS_ADMIN'],[workerId,'WORKER']]){
   const role=await prisma.role.upsert({where:{key},update:{},create:{key,name:key}});
   await prisma.membership.create({data:{userId:id,orgId,roleId:role.id,status:'ACTIVE'}});
  }
  const actor=(userId:string)=>({tenantId,orgId,userId,roles:[]});
  await assert.rejects(service.list(actor(ownerId),orgId),{status:403});
  await assert.rejects(prisma.orgOwnership.create({data:{orgId,tenantId:foreignTenantId,ownerUserId:ownerId,verifiedByUserId:opsId,evidenceRef:'fixture://owner',reason:'fixture',ticket:'QA'}}));
  const input={ownerUserId:ownerId,evidenceRef:'fixture://verified',reason:'Synthetic verification',ticket:'QA-BO05'};
  const results=await Promise.allSettled([service.verifyOwner(actor(opsId),orgId,'qa1',input),service.verifyOwner(actor(opsId),orgId,'qa2',{...input,ownerUserId:otherId})]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(await prisma.orgOwnership.count({where:{orgId}}),1);
  assert.equal(await prisma.auditLog.count({where:{tenantId,action:'organization.owner_verified'}}),1);
  const binding=await prisma.orgOwnership.findUniqueOrThrow({where:{orgId}});
  const deniedId=binding.ownerUserId===ownerId?otherId:ownerId;
  await assert.rejects(service.list(actor(deniedId),orgId),{status:403});
  const owner=actor(binding.ownerUserId);
  failAudit=true;await assert.rejects(service.create(owner,orgId,'qa3',{recipientUserId:workerId,positionTitle:'Synthetic role'}),/injected audit failure/);
  assert.equal(await prisma.businessOffer.count({where:{orgId}}),0);
  assert.equal(await prisma.auditLog.count({where:{tenantId,action:'business_offer.sent'}}),0);
  failAudit=false;const offer=await service.create(owner,orgId,'qa4',{recipientUserId:workerId,positionTitle:'Synthetic role'});
  failAudit=true;await assert.rejects(service.respond({userId:workerId},offer.offerId,'ACCEPT','qa5'),/injected audit failure/);
  assert.equal((await prisma.businessOffer.findUniqueOrThrow({where:{id:offer.offerId}})).status,'SENT');
  assert.equal(await prisma.businessEngagement.count({where:{orgId}}),0);
 }finally{
  if(previous===undefined)delete process.env.SEMSE_BUSINESS_OFFERS_ENABLED;else process.env.SEMSE_BUSINESS_OFFERS_ENABLED=previous;
  // Delete only IDs created by this test, in FK order. Never broad cleanup.
  await prisma.businessEngagement.deleteMany({where:{orgId}});
  await prisma.businessOffer.deleteMany({where:{orgId}});
  await prisma.orgOwnership.deleteMany({where:{orgId}});
  await prisma.membership.deleteMany({where:{orgId}});
  await prisma.auditLog.deleteMany({where:{tenantId}});
  await prisma.org.deleteMany({where:{id:orgId}});
  await prisma.user.deleteMany({where:{id:{in:userIds}}});
  await prisma.tenant.deleteMany({where:{id:{in:tenantIds}}});
  await prisma.$disconnect();
 }
});
