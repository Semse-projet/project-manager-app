import 'reflect-metadata';
import test from 'node:test';import assert from 'node:assert/strict';
import {fork,type ChildProcess} from 'node:child_process';
import {once} from 'node:events';import {randomBytes,createHash} from 'node:crypto';
import {Redis} from 'ioredis';
import {signInvitationProxy} from '@semse/auth/invitation-proxy';

const redisTest=process.env.REDIS_URL?test:test.skip;
redisTest('BO-01 real Redis + two Nest processes: cold-start concurrency, atomic quota, spoof rejection, client and route isolation',async()=>{
 const key=randomBytes(32).toString('hex');const children:ChildProcess[]=[];const redis=new Redis(process.env.REDIS_URL!,{maxRetriesPerRequest:1,connectTimeout:1000,commandTimeout:1000,retryStrategy:()=>null});redis.on("error",()=>{});
 const ip1='2001:db8:'+randomBytes(2).toString('hex')+':'+randomBytes(2).toString('hex')+'::1';
 const ip2=ip1.slice(0,-1)+'2';
 async function replica(redisUrl=process.env.REDIS_URL!){
  const child=fork(new URL('./fixtures/invitation-replica.ts',import.meta.url),[],{execArgv:['--experimental-strip-types'],env:{...process.env,REDIS_URL:redisUrl,NODE_ENV:'production',SEMSE_ORG_INVITATIONS_ENABLED:'true',SEMSE_INVITATION_EMAIL_DELIVERY:'true',SEMSE_INVITED_REGISTRATION_ENABLED:'true',SEMSE_INVITATION_PROXY_KEY:key},stdio:['ignore','ignore','pipe','ipc']});
  children.push(child);
  const message=await new Promise<{port:number}>((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('Replica start timeout')),15000);
   child.once('error',e=>{clearTimeout(timer);reject(e);});child.once('exit',()=>{clearTimeout(timer);reject(Error('Replica exited before readiness'));});
   child.once('message',m=>{clearTimeout(timer);resolve(m as {port:number});});
  });return 'http://127.0.0.1:'+message.port;
 }
 async function post(origin:string,path:string,ip=ip1,extra:Record<string,string>={}){
  const response=await fetch(origin+path,{method:'POST',headers:{...signInvitationProxy(key,ip,'POST',path.replace(/\/$/,'')),...extra},signal:AbortSignal.timeout(5000)});await response.arrayBuffer();return response.status;
 }
 try{
  const [a,b]=await Promise.all([replica(),replica()]);
  assert.equal((await fetch(a+'/v1/invitations/preview',{method:'POST',headers:{'x-forwarded-for':ip1,'x-real-ip':ip1}})).status,401);
  // First real Redis connection is created by this burst, not warmed up in advance.
  const statuses=await Promise.all(Array.from({length:24},(_,i)=>post(i%2?a:b,'/v1/invitations/preview')));
  assert.equal(statuses.filter(s=>s===201).length,10,JSON.stringify(statuses));
  assert.equal(statuses.filter(s=>s===429).length,14,JSON.stringify(statuses));
  assert.equal(await post(b,'/v1/invitations/preview',ip1,{'x-forwarded-for':ip2}),429);
  assert.equal(await post(a,'/v1/invitations/preview',ip2),201);
  for(let i=0;i<5;i++)assert.equal(await post(i%2?a:b,'/v1/invitations/register'),201);
  assert.equal(await post(a,'/v1/invitations/register'),429);
  const unavailable=await replica('redis://127.0.0.1:1');
  assert.equal(await post(unavailable,'/v1/invitations/preview',ip2),503);
  const bucket='invitation:'+createHash('sha256').update('/v1/invitations/preview\n'+ip1).digest('hex');
  const ttl=await redis.pttl(bucket);assert.ok(ttl>0&&ttl<=60000);
 }finally{
  await Promise.all(children.map(async c=>{if(c.exitCode!==null)return;const exited=once(c,'exit');c.send('close');await Promise.race([exited,new Promise<void>(resolve=>{const timer=setTimeout(()=>{if(c.exitCode===null)c.kill('SIGTERM');resolve();},5000);timer.unref();})]);}));
  const buckets=['preview','register'].flatMap(action=>[ip1,ip2].map(ip=>'invitation:'+createHash('sha256').update('/v1/invitations/'+action+'\n'+ip).digest('hex')));
  try { await redis.del(...buckets); } finally { redis.disconnect(); }
 }
});
