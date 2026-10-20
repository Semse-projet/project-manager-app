import 'reflect-metadata';
import test from 'node:test';import assert from 'node:assert/strict';
import {InvitationThrottlerGuard} from '../dist/common/invitation-throttler.guard.js';
import {signInvitationProxy} from '@semse/auth/invitation-proxy';
const key='test-only-'.repeat(5);
function context(action:string,headers:Record<string,string>={},url='/arbitrary-trailing-spelling/'){
 class Controller{}function handler(){}
 Reflect.defineMetadata('path','v1/invitations',Controller);Reflect.defineMetadata('path',action,handler);
 return {getClass:()=>Controller,getHandler:()=>handler,switchToHttp:()=>({getRequest:()=>({url,method:'POST',headers,ip:'127.0.0.1'})})} as any;
}
function guard(store:any){const g=Object.create(InvitationThrottlerGuard.prototype);g.invitationRedis=store;return g as InvitationThrottlerGuard;}
test('production signature is mandatory; disabled flags and failed store fail closed',async()=>{
 const previous={...process.env};Object.assign(process.env,{NODE_ENV:'production',SEMSE_ORG_INVITATIONS_ENABLED:'true',SEMSE_INVITATION_PROXY_KEY:key,REDIS_URL:'redis://fixture.invalid'});
 try{
 const g=guard({status:'ready',eval:async()=>{throw Error('offline');}});
 await assert.rejects(g.canActivate(context('preview',{'x-real-ip':'1.2.3.4','x-forwarded-for':'1.2.3.4'})),{status:401});
 const signed=signInvitationProxy(key,'192.0.2.1','POST','/v1/invitations/preview');
 await assert.rejects(g.canActivate(context('preview',signed)),{status:503});
 process.env.SEMSE_ORG_INVITATIONS_ENABLED='false';await assert.rejects(g.canActivate(context('preview',signed)),{status:404});
 }finally{for(const k of Object.keys(process.env))if(!(k in previous))delete process.env[k];Object.assign(process.env,previous);}
});
test('two guard replicas share client bucket; unrelated client and route isolated; URL spelling cannot bypass',async()=>{
 const previous={...process.env};Object.assign(process.env,{NODE_ENV:'production',SEMSE_ORG_INVITATIONS_ENABLED:'true',SEMSE_INVITATION_EMAIL_DELIVERY:'true',SEMSE_INVITED_REGISTRATION_ENABLED:'true',SEMSE_INVITATION_PROXY_KEY:key,REDIS_URL:'redis://fixture.invalid'});
 try{
 const counts=new Map<string,number>();const store={status:'ready',eval:async(script:string,_n:number,bucket:string,ttl:number)=>{assert.match(script,/PEXPIRE/);assert.equal(ttl,60000);const n=(counts.get(bucket)??0)+1;counts.set(bucket,n);return n;}};
 const a=guard(store),b=guard(store);const one=signInvitationProxy(key,'192.0.2.1','POST','/v1/invitations/preview');
 for(let i=0;i<10;i++)assert.equal(await (i%2?a:b).canActivate(context('preview',one)),true);
 await assert.rejects(a.canActivate(context('preview',one)),{status:429});
 assert.equal(await b.canActivate(context('preview',signInvitationProxy(key,'192.0.2.2','POST','/v1/invitations/preview'))),true);
 const register=signInvitationProxy(key,'192.0.2.1','POST','/v1/invitations/register');
 for(let i=0;i<5;i++)assert.equal(await b.canActivate(context('register',register)),true);
 await assert.rejects(a.canActivate(context('register',register)),{status:429});
 }finally{for(const k of Object.keys(process.env))if(!(k in previous))delete process.env[k];Object.assign(process.env,previous);}
});
