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
  // DECISION_TELEMETRY is also exported directly for callers that write their
  // own JevDecisionEvent rows without going through decide() — e.g. the
  // Marketplace confidence gate, which is fully deterministic (no Jev/LLM
  // call) and only reuses the telemetry table for a consistent review UX.
  exports: [DecisionLayerService, DECISION_TELEMETRY],
})
export class DecisionLayerModule {}
