import { Injectable, NotImplementedException, Optional } from "@nestjs/common";
import type { PaymentProviderPort } from "./payment-provider.port.js";
import { MockPaymentProvider } from "./mock-payment.provider.js";
import { StripePaymentProvider } from "./stripe.provider.js";
import { BankTransferPaymentProvider } from "./bank-transfer.provider.js";
import { PaypalPaymentProvider } from "./paypal.provider.js";
import { AdyenPaymentProvider } from "./adyen.provider.js";
import { type PaymentProviderKey } from "../payments.types.js";

@Injectable()
export class PaymentProviderRegistry {
  private readonly providers: Map<PaymentProviderKey, PaymentProviderPort>;

  constructor(
    mockPaymentProvider: MockPaymentProvider,
    bankTransferPaymentProvider: BankTransferPaymentProvider,
    @Optional() stripePaymentProvider?: StripePaymentProvider,
    @Optional() paypalPaymentProvider?: PaypalPaymentProvider,
    @Optional() adyenPaymentProvider?: AdyenPaymentProvider,
  ) {
    this.providers = new Map<PaymentProviderKey, PaymentProviderPort>([
      [mockPaymentProvider.key, mockPaymentProvider],
      [bankTransferPaymentProvider.key, bankTransferPaymentProvider],
    ]);
    if (stripePaymentProvider) {
      this.providers.set(stripePaymentProvider.key, stripePaymentProvider);
    }
    if (paypalPaymentProvider) {
      this.providers.set(paypalPaymentProvider.key, paypalPaymentProvider);
    }
    if (adyenPaymentProvider) {
      this.providers.set(adyenPaymentProvider.key, adyenPaymentProvider);
    }
  }

  resolve(providerKey: PaymentProviderKey): PaymentProviderPort {
    const provider = this.providers.get(providerKey);
    if (!provider) {
      throw new NotImplementedException(`payment provider '${providerKey}' is not configured`);
    }

    return provider;
  }

  availableKeys(): PaymentProviderKey[] {
    return Array.from(this.providers.keys());
  }
}
