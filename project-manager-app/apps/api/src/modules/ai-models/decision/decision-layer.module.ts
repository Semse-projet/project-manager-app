import { Module } from "@nestjs/common";
import { resolveDecisionLayerConfig } from "./decision-flags.js";
import { DECISION_PROVIDER, DECISION_TELEMETRY, DecisionLayerService } from "./decision-layer.service.js";
import { PrismaDecisionTelemetry } from "./decision-telemetry.repository.js";
import { JevHttpProvider } from "./jev.provider.js";

// Deliberately dependency-light (Prisma is @Global) so both AiModelsModule
// (Agent Router) and VisionModule (Decision Gate) can import it without
// pulling AiModelsModule's Finance/Intelligence/Prometeo graph into Vision.
@Module({
  providers: [
    { provide: DECISION_PROVIDER, useFactory: () => new JevHttpProvider(resolveDecisionLayerConfig().provider) },
    { provide: DECISION_TELEMETRY, useClass: PrismaDecisionTelemetry },
    DecisionLayerService,
  ],
  exports: [DecisionLayerService],
})
export class DecisionLayerModule {}
