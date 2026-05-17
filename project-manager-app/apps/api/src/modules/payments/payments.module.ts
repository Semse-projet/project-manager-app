import { Module, forwardRef } from "@nestjs/common";
import { ContractsModule } from "../contracts/contracts.module.js";
import { KnowledgeModule } from "../knowledge/knowledge.module.js";
import { MilestonesModule } from "../milestones/milestones.module.js";
import { ProjectsModule } from "../projects/projects.module.js";
import { ReservationsModule } from "../reservations/reservations.module.js";
import { PaymentsController } from "./payments.controller.js";
import { PaymentGovernanceService } from "./payment-governance.service.js";
import { PaymentsRepository } from "./payments.repository.js";
import { PaymentsService } from "./payments.service.js";
import { MockPaymentProvider } from "./providers/mock-payment.provider.js";
import { StripePaymentProvider } from "./providers/stripe.provider.js";
import { PaymentProviderRegistry } from "./providers/payment-provider.registry.js";

const stripeProviders = process.env.STRIPE_SECRET_KEY?.trim()
  ? [StripePaymentProvider]
  : [];

@Module({
  imports: [ProjectsModule, ContractsModule, KnowledgeModule, ReservationsModule, forwardRef(() => MilestonesModule)],
  controllers: [PaymentsController],
  providers: [
    PaymentsRepository,
    PaymentsService,
    PaymentGovernanceService,
    MockPaymentProvider,
    ...stripeProviders,
    PaymentProviderRegistry,
  ],
  exports: [PaymentsRepository, PaymentsService, PaymentGovernanceService]
})
export class PaymentsModule {}
