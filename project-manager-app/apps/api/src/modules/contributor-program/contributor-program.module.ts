import { forwardRef, Module } from "@nestjs/common";
import { PrismaModule } from "../../infrastructure/prisma/prisma.module.js";
import { SseInfraModule } from "../../infrastructure/sse/sse-infra.module.js";
import { StorageModule } from "../../infrastructure/storage/storage.module.js";
import { AiModelsModule } from "../ai-models/ai-models.module.js";
import { PaymentsModule } from "../payments/payments.module.js";
import { PrometeoModule } from "../prometeo/prometeo.module.js";
import { ContributorProgramController } from "./contributor-program.controller.js";
import { ContributorProgramRepository } from "./contributor-program.repository.js";
import { ContributorProgramService } from "./contributor-program.service.js";

@Module({
  // PR-10: PaymentsModule needs ContributorProgramService back (for
  // transfer.reversed reconciliation), so this import is circular now —
  // forwardRef on both sides is this repo's established pattern for that
  // (see jobs.module.ts/projects.module.ts). PrometeoModule also needs
  // forwardRef here: it imports PaymentsModule itself, so loading it
  // eagerly during this same cycle hit a real ESM TDZ error (confirmed by
  // actually booting the API, not just tsc) — forwardRef defers the
  // reference past module-load time for every module in the cycle, not
  // just the two that added the new edge.
  imports: [
    PrismaModule,
    SseInfraModule,
    StorageModule,
    // PR-12: AiModelsModule itself imports PrometeoModule, which is already
    // part of the PaymentsModule/PrometeoModule cycle below — so this edge
    // needs forwardRef too, for the same reason PrometeoModule does (a real
    // TDZ error confirmed by booting, not just a defensive guess).
    forwardRef(() => AiModelsModule),
    forwardRef(() => PaymentsModule),
    forwardRef(() => PrometeoModule)
  ],
  controllers: [ContributorProgramController],
  providers: [ContributorProgramRepository, ContributorProgramService],
  exports: [ContributorProgramService]
})
export class ContributorProgramModule {}
