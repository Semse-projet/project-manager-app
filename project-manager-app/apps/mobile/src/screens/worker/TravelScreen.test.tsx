import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { fetchMyTravelAssignments } from "../../api/travel";
import TravelScreen from "./TravelScreen";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => require("react").useEffect(effect, []),
}));
jest.mock("../../api/travel", () => ({
  fetchMyTravelAssignments: jest.fn(),
}));

const navigate = jest.fn();
const mockNavigation = { navigate } as unknown as Parameters<typeof TravelScreen>[0]["navigation"];
const mockRoute = {} as unknown as Parameters<typeof TravelScreen>[0]["route"];

beforeEach(() => {
  jest.clearAllMocks();
});

it("shows an empty state when there are no travel assignments", async () => {
  (fetchMyTravelAssignments as jest.Mock).mockResolvedValue([]);
  await render(<TravelScreen navigation={mockNavigation} route={mockRoute} />);
  await waitFor(() => expect(screen.getByText("No tienes asignaciones de viaje.")).toBeTruthy());
});

it("lists assignments with spend info and missing receipts, and navigates on press", async () => {
  (fetchMyTravelAssignments as jest.Mock).mockResolvedValue([
    {
      id: "t1", tenantId: "t1", jobId: "job1", assignedTo: "u1", destinationCity: "Monterrey",
      departureDate: "2026-08-10", returnDate: "2026-08-15", estimatedDays: 5, requiresLodging: true,
      headcount: 1, mainTransportMode: null, approvedBudget: 1000, approvedBy: null, status: "ACTIVE",
      notes: null, createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-01T00:00:00Z",
      totalSpent: 300, expectedBalance: 700, missingReceipts: 2, missingExpenseReceipts: 1,
      missingLodgingReceipts: 1, receiptCount: 3, expenseCount: 2, lodgingCount: 1, advanceCount: 0,
    },
  ]);
  await render(<TravelScreen navigation={mockNavigation} route={mockRoute} />);
  await waitFor(() => expect(screen.getByText("Monterrey")).toBeTruthy());
  expect(screen.getByText("En curso")).toBeTruthy();
  expect(screen.getByText("⚠ 2 recibo(s) pendiente(s)")).toBeTruthy();

  await fireEvent.press(screen.getByText("Monterrey"));
  expect(navigate).toHaveBeenCalledWith("TravelDetail", { travelId: "t1" });
});
