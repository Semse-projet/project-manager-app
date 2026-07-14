import { Module, forwardRef } from "@nestjs/common";
import { IdempotencyService } from "../../common/idempotency.service.js";
import { AgentQueueModule } from "../../infrastructure/queue/agent-queue.module.js";
import { LLMModule } from "../../infrastructure/llm/llm.module.js";
import { DisputesModule } from "../disputes/disputes.module.js";
import { KnowledgeModule } from "../knowledge/knowledge.module.js";
import { MilestonesModule } from "../milestones/milestones.module.js";
import { PaymentsModule } from "../payments/payments.module.js";
import { ProjectsModule } from "../projects/projects.module.js";
import { UsersModule } from "../users/users.module.js";
import { AgentApprovalService } from "./agent-approval.service.js";
import { AgentPolicyService } from "./agent-policy.service.js";
import { AgentWorkPlanService } from "./agent-work-plan.service.js";
import { AgentsController } from "./agents.controller.js";
import { AgentsRepository } from "./agents.repository.js";
import { AgentsService } from "./agents.service.js";
import { PlanExecutionService } from "./plan-execution.service.js";
import { PlanModeService } from "./plan-mode.service.js";
import { PlanToolPolicyService } from "./plan-tool-policy.service.js";
import { TechnicalRuntimeService } from "./technical-runtime.service.js";
import { AgentDelegationRepository } from "./agent-delegation.repository.js";
import { AgentDelegationService } from "./agent-delegation.service.js";
import { CoordinatorService } from "./coordinator.service.js";
import { PlanTemplatesService } from "./plan-templates.service.js";
import { ProjectCopilotHarness } from "./harnesses/project-copilot.harness.js";
import { PrometeoModule } from "../prometeo/prometeo.module.js";
import { AiModelsModule } from "../ai-models/ai-models.module.js";
import { BrowserAgentModule } from "../browser-agent/browser-agent.module.js";

@Module({
  imports: [AgentQueueModule, LLMModule, ProjectsModule, KnowledgeModule, MilestonesModule, DisputesModule, PaymentsModule, UsersModule, PrometeoModule, AiModelsModule, forwardRef(() => BrowserAgentModule)],
  controllers: [AgentsController],
  providers: [
    AgentApprovalService,
    AgentPolicyService,
    AgentWorkPlanService,
    PlanToolPolicyService,
    PlanExecutionService,
    PlanModeService,
    TechnicalRuntimeService,
    AgentsRepository,
    AgentsService,
    AgentDelegationRepository,
    AgentDelegationService,
    CoordinatorService,
    PlanTemplatesService,
    ProjectCopilotHarness,
    IdempotencyService,
  ],
  exports: [
    AgentApprovalService,
    AgentPolicyService,
    AgentWorkPlanService,
    PlanToolPolicyService,
    PlanExecutionService,
    PlanModeService,
    TechnicalRuntimeService,
    AgentsService,
    AgentDelegationService,
    CoordinatorService,
    PlanTemplatesService,
    ProjectCopilotHarness,
  ],
})
export class AgentsModule {}
