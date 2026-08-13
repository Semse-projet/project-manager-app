import { Module } from "@nestjs/common";
import { PrismaModule } from "../../infrastructure/prisma/prisma.module.js";
import { DomainEventsModule } from "../domain-events/domain-events.module.js";
import { OriginatorController } from "./originator.controller.js";
import { OriginatorRepository } from "./originator.repository.js";
import { OriginatorService } from "./originator.service.js";

@Module({
  imports: [PrismaModule, DomainEventsModule],
  controllers: [OriginatorController],
  providers: [OriginatorRepository, OriginatorService],
  exports: [OriginatorService],
})
export class OriginatorModule {}
