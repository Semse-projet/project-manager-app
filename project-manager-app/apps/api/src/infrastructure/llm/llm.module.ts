import { Module } from "@nestjs/common";
import { ProviderMetricsStore } from "./metrics/provider-metrics.store.js";
import { LLMOrchestrator } from "./orchestrator.js";
import { AdaptiveRouter } from "./router/adaptive-router.js";
import { LLMService } from "./llm.service.js";

@Module({
  providers: [ProviderMetricsStore, AdaptiveRouter, LLMOrchestrator, LLMService],
  exports: [LLMService, LLMOrchestrator, ProviderMetricsStore],
})
export class LLMModule {}
