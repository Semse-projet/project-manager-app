import { Module, forwardRef } from "@nestjs/common";
import { ContractsModule } from "../contracts/contracts.module.js";
import { KnowledgeModule } from "../knowledge/knowledge.module.js";
import { MilestonesModule } from "../milestones/milestones.module.js";
import { NotificationsModule } from "../notifications/notifications.module.js";
import { ProjectsModule } from "../projects/projects.module.js";
import { ReservationsModule } from "../reservations/reservations.module.js";
import { PaymentsController } from "./payments.controller.js";
import { PaymentGovernanceService } from "./payment-governance.service.js";
import { PaymentsRepository } from "./payments.repository.js";
import { PaymentsService } from "./payments.service.js";
import { AdyenPaymentProvider } from "./providers/adyen.provider.js";
import { BankTransferPaymentProvider } from "./providers/bank-transfer.provider.js";
import { MockPaymentProvider } from "./providers/mock-payment.provider.js";
import { PaypalPaymentProvider } from "./providers/paypal.provider.js";
import { StripePaymentProvider } from "./providers/stripe.provider.js";
import { PaymentProviderRegistry } from "./providers/payment-provider.registry.js";
import { StripeConnectService } from "./stripe-connect.service.js";
import { StripeConnectController } from "./stripe-connect.controller.js";
import { EscrowReleaseService } from "./escrow-release.service.js";

const stripeProviders = process.env.STRIPE_SECRET_KEY?.trim()
  ? [StripePaymentProvider]
  : [];
const paypalProviders = process.env.PAYPAL_CLIENT_ID?.trim() && process.env.PAYPAL_CLIENT_SECRET?.trim()
  ? [PaypalPaymentProvider]
  : [];
const adyenProviders = process.env.ADYEN_API_KEY?.trim() && process.env.ADYEN_MERCHANT_ACCOUNT?.trim()
  ? [AdyenPaymentProvider]
  : [];

@Module({
  imports: [ProjectsModule, ContractsModule, KnowledgeModule, NotificationsModule, ReservationsModule, forwardRef(() => MilestonesModule)],
  controllers: [PaymentsController, StripeConnectController],
  providers: [
    PaymentsRepository,
    PaymentsService,
    PaymentGovernanceService,
    MockPaymentProvider,
    BankTransferPaymentProvider,
    ...stripeProviders,
    ...paypalProviders,
    ...adyenProviders,
    PaymentProviderRegistry,
    StripeConnectService,
    EscrowReleaseService,
  ],
  exports: [PaymentsRepository, PaymentsService, PaymentGovernanceService, StripeConnectService, EscrowReleaseService]
})
export class PaymentsModule {}
