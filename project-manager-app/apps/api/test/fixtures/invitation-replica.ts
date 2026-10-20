import 'reflect-metadata';
import {Controller,Module,Post} from '@nestjs/common';
import {APP_GUARD,NestFactory} from '@nestjs/core';
import {FastifyAdapter} from '@nestjs/platform-fastify';
import {ThrottlerModule} from '@nestjs/throttler';
import {InvitationThrottlerGuard} from '../../dist/common/invitation-throttler.guard.js';

// Only the invitation limiter is in scope; business/auth handlers are deliberate fixtures.
class ProbeController {
 async preview(){return {ok:true};}
 async register(){return {ok:true};}
}
Controller('v1/invitations')(ProbeController);
for(const action of ['preview','register'])Post(action)(ProbeController.prototype,action,Object.getOwnPropertyDescriptor(ProbeController.prototype,action)!);
class ProbeModule{}
Module({imports:[ThrottlerModule.forRoot([{ttl:60000,limit:100}])],controllers:[ProbeController],providers:[{provide:APP_GUARD,useClass:InvitationThrottlerGuard}]})(ProbeModule);
const app=await NestFactory.create(ProbeModule,new FastifyAdapter(),{logger:false});
await app.listen(0,'127.0.0.1');
const address=app.getHttpServer().address();
if(!address||typeof address==='string')throw Error('Missing fixture listener');
process.send?.({port:address.port});
process.on('message',async message=>{if(message==='close'){await app.close();process.disconnect?.();}});
