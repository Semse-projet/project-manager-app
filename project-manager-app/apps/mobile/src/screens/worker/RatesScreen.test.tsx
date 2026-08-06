import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { fetchLaborRates, resetLaborRates, saveLaborRates } from "../../api/pricing";
import RatesScreen from "./RatesScreen";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => require("react").useEffect(effect, []),
}));
jest.mock("../../api/pricing", () => ({
  fetchLaborRates: jest.fn(),
  saveLaborRates: jest.fn(),
  resetLaborRates: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

it("shows the national baseline when there is no custom rate", async () => {
  (fetchLaborRates as jest.Mock).mockResolvedValue({ override: null, nationalBaselineHourlyRate: 24.43, hasCustomRates: false });
  await render(<RatesScreen />);
  await waitFor(() => expect(screen.getByText(/Referencia nacional \(BLS\)/)).toBeTruthy());
  expect(screen.queryByText("Volver a la referencia BLS")).toBeNull();
});

it("pre-fills the form and allows resetting when a custom rate exists", async () => {
  (fetchLaborRates as jest.Mock).mockResolvedValue({
    override: { userId: "u1", laborRatePerHr: 45, materialMarkup: 0.15, laborMultiplier: 1.8, materialMultiplier: 1.15, notes: "Zona premium", updatedAt: "2026-01-01T00:00:00Z" },
    nationalBaselineHourlyRate: 24.43,
    hasCustomRates: true,
  });
  (resetLaborRates as jest.Mock).mockResolvedValue({ deleted: true, revertedToBls: true });
  await render(<RatesScreen />);
  await waitFor(() => expect(screen.getByDisplayValue("45")).toBeTruthy());
  expect(screen.getByDisplayValue("15")).toBeTruthy();
  expect(screen.getByDisplayValue("Zona premium")).toBeTruthy();

  await fireEvent.press(screen.getByText("Volver a la referencia BLS"));
  await waitFor(() => expect(resetLaborRates).toHaveBeenCalled());
});

it("saves a new rate", async () => {
  (fetchLaborRates as jest.Mock).mockResolvedValue({ override: null, nationalBaselineHourlyRate: 24.43, hasCustomRates: false });
  (saveLaborRates as jest.Mock).mockResolvedValue({ override: { userId: "u1", laborRatePerHr: 50, materialMarkup: 0.1, laborMultiplier: 2, materialMultiplier: 1.1, updatedAt: "2026-01-01T00:00:00Z" }, saved: true });
  await render(<RatesScreen />);
  await waitFor(() => expect(screen.getByText("Guardar")).toBeTruthy());

  await fireEvent.changeText(screen.getAllByPlaceholderText("0")[0], "50");
  await fireEvent.press(screen.getByText("Guardar"));

  await waitFor(() => expect(saveLaborRates).toHaveBeenCalledWith(expect.objectContaining({ laborRatePerHr: 50 })));
});
