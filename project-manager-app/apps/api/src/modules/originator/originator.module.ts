import { Module } from "@nestjs/common";
import { PrismaModule } from "../../infrastructure/prisma/prisma.module.js";
import { DomainEventsModule } from "../domain-events/domain-events.module.js";
import { OriginatorController } from "./originator.controller.js";
import { OriginatorRepository } from "./originator.repository.js";
import { OriginatorService } from "./originator.service.js";

// Deliberately does NOT import PaymentsModule: PaymentsService needs
// OriginatorService (to fire the milestone-funded trigger), which would
// make this a circular module dependency. The two aggregate queries this
// needs (deposited/released totals) are inlined instead — see
// originator.service.ts.
@Module({
  imports: [PrismaModule, DomainEventsModule],
  controllers: [OriginatorController],
  providers: [OriginatorRepository, OriginatorService],
  exports: [OriginatorService],
})
export class OriginatorModule {}
