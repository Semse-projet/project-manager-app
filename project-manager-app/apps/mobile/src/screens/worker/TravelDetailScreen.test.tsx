import { render, screen, waitFor } from "@testing-library/react-native";
import { fetchTravelAssignmentDetail } from "../../api/travel";
import TravelDetailScreen from "./TravelDetailScreen";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => require("react").useEffect(effect, []),
}));
jest.mock("../../api/travel", () => ({
  fetchTravelAssignmentDetail: jest.fn(),
}));

const mockNavigation = {} as unknown as Parameters<typeof TravelDetailScreen>[0]["navigation"];
const baseRoute = { params: { travelId: "t1" } } as unknown as Parameters<typeof TravelDetailScreen>[0]["route"];

beforeEach(() => {
  jest.clearAllMocks();
});

it("shows the assignment's destination, dates and budget", async () => {
  (fetchTravelAssignmentDetail as jest.Mock).mockResolvedValue({
    id: "t1", tenantId: "t1", jobId: "job1", assignedTo: "u1", destinationCity: "Monterrey",
    departureDate: "2026-08-10", returnDate: "2026-08-15", estimatedDays: 5, requiresLodging: true,
    headcount: 2, mainTransportMode: "Vuelo", approvedBudget: 1000, approvedBy: "admin1", status: "PLANNED",
    notes: "Llevar equipo de seguridad", createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-01T00:00:00Z",
  });
  await render(<TravelDetailScreen navigation={mockNavigation} route={baseRoute} />);

  await waitFor(() => expect(screen.getByText("Monterrey")).toBeTruthy());
  expect(screen.getByText("Planeado")).toBeTruthy();
  expect(screen.getByText("Transporte: Vuelo")).toBeTruthy();
  expect(screen.getByText("Llevar equipo de seguridad")).toBeTruthy();
});
