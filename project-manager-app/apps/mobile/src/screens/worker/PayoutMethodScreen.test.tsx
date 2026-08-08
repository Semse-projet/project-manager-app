import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { fetchPayoutMethod, savePayoutMethod } from "../../api/payoutMethod";
import { isStripeConfigured } from "../../config/stripe";
import PayoutMethodScreen from "./PayoutMethodScreen";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => require("react").useEffect(effect, []),
}));
jest.mock("../../api/payoutMethod", () => ({
  fetchPayoutMethod: jest.fn(),
  savePayoutMethod: jest.fn(),
}));
jest.mock("../../config/stripe", () => ({
  isStripeConfigured: jest.fn(),
  STRIPE_PUBLISHABLE_KEY: "pk_test_mock",
}));

const mockCreateToken = jest.fn();
jest.mock("@stripe/stripe-react-native", () => ({
  useStripe: () => ({ createToken: mockCreateToken }),
  CardField: () => null,
}));

beforeEach(() => {
  jest.clearAllMocks();
});

it("shows a not-configured message when Stripe isn't set up", async () => {
  (isStripeConfigured as jest.Mock).mockReturnValue(false);
  await render(<PayoutMethodScreen />);
  await waitFor(() =>
    expect(screen.getByText(/El método de cobro no está disponible todavía/)).toBeTruthy(),
  );
  expect(fetchPayoutMethod).not.toHaveBeenCalled();
});

it("shows the current payout method when one exists", async () => {
  (isStripeConfigured as jest.Mock).mockReturnValue(true);
  (fetchPayoutMethod as jest.Mock).mockResolvedValue({
    type: "paypal", label: "PayPal", email: "worker@demo.semse", verified: false,
  });
  await render(<PayoutMethodScreen />);
  await waitFor(() => expect(screen.getByText("Método actual: PayPal")).toBeTruthy());
  expect(screen.getByText("worker@demo.semse")).toBeTruthy();
});

it("saves a paypal payout method without touching Stripe tokenization", async () => {
  (isStripeConfigured as jest.Mock).mockReturnValue(true);
  (fetchPayoutMethod as jest.Mock).mockResolvedValue(null);
  (savePayoutMethod as jest.Mock).mockResolvedValue({
    type: "paypal", label: "PayPal", email: "worker@demo.semse", verified: false,
  });
  await render(<PayoutMethodScreen />);
  await waitFor(() => expect(screen.getByText("PayPal")).toBeTruthy());

  await fireEvent.press(screen.getByText("PayPal"));
  await fireEvent.changeText(screen.getByPlaceholderText("tu@email.com"), "worker@demo.semse");
  await fireEvent.press(screen.getByText("Guardar método de cobro"));

  await waitFor(() => expect(savePayoutMethod).toHaveBeenCalledWith({
    type: "paypal",
    bankName: undefined,
    stripeToken: undefined,
    last4: undefined,
    email: "worker@demo.semse",
  }));
  expect(mockCreateToken).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.getByText("✅ Guardado")).toBeTruthy());
});

it("tokenizes a bank account through Stripe before saving", async () => {
  (isStripeConfigured as jest.Mock).mockReturnValue(true);
  (fetchPayoutMethod as jest.Mock).mockResolvedValue(null);
  mockCreateToken.mockResolvedValue({ token: { id: "tok_bank_1", bankAccount: { last4: "6789" } } });
  (savePayoutMethod as jest.Mock).mockResolvedValue({
    type: "bank_account", label: "Cuenta bancaria", bankName: "Chase", last4: "6789", verified: false,
  });
  await render(<PayoutMethodScreen />);
  await waitFor(() => expect(screen.getByText("Cuenta bancaria")).toBeTruthy());

  await fireEvent.changeText(screen.getByPlaceholderText("Nombre del banco"), "Chase");
  await fireEvent.changeText(screen.getByPlaceholderText("000000000"), "021000021");
  await fireEvent.changeText(screen.getByPlaceholderText("Hasta 17 dígitos"), "1234567890");
  await fireEvent.press(screen.getByText("Guardar método de cobro"));

  await waitFor(() => expect(mockCreateToken).toHaveBeenCalledWith(expect.objectContaining({
    type: "BankAccount",
    routingNumber: "021000021",
    accountNumber: "1234567890",
  })));
  await waitFor(() => expect(savePayoutMethod).toHaveBeenCalledWith(expect.objectContaining({
    type: "bank_account",
    bankName: "Chase",
    stripeToken: "tok_bank_1",
    last4: "6789",
  })));
});
