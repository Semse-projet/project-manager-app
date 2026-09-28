import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { fetchAgroIncidents } from "../../api/agro";
import AgroIncidentsScreen from "./AgroIncidentsScreen";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => require("react").useEffect(effect, []),
}));
jest.mock("../../api/agro", () => ({
  fetchAgroIncidents: jest.fn(),
}));

const navigate = jest.fn();
const mockNavigation = { navigate } as unknown as Parameters<typeof AgroIncidentsScreen>[0]["navigation"];
const baseRoute = { params: { farmId: "farm1", farmName: "Finca El Roble" } } as unknown as Parameters<typeof AgroIncidentsScreen>[0]["route"];

beforeEach(() => {
  jest.clearAllMocks();
});

it("shows an empty state naming the farm when there are no incidents", async () => {
  (fetchAgroIncidents as jest.Mock).mockResolvedValue([]);
  await render(<AgroIncidentsScreen navigation={mockNavigation} route={baseRoute} />);
  await waitFor(() => expect(screen.getByText("Sin incidencias reportadas en Finca El Roble.")).toBeTruthy());
  expect(fetchAgroIncidents).toHaveBeenCalledWith("farm1");
});

it("lists incidents with severity and status", async () => {
  (fetchAgroIncidents as jest.Mock).mockResolvedValue([
    {
      id: "inc1", type: "WATER_SHORTAGE", severity: "HIGH", status: "OPEN",
      title: "Falta agua en lote 15", description: null,
      detectedAt: "2026-01-01T00:00:00.000Z", occurredAt: null,
    },
  ]);
  await render(<AgroIncidentsScreen navigation={mockNavigation} route={baseRoute} />);
  await waitFor(() => expect(screen.getByText("Falta agua en lote 15")).toBeTruthy());
  expect(screen.getByText("Alta")).toBeTruthy();
});

it("navigates to the report screen when the button is pressed", async () => {
  (fetchAgroIncidents as jest.Mock).mockResolvedValue([]);
  await render(<AgroIncidentsScreen navigation={mockNavigation} route={baseRoute} />);
  await waitFor(() => expect(screen.getByText("+ Reportar incidencia")).toBeTruthy());

  await fireEvent.press(screen.getByText("+ Reportar incidencia"));
  expect(navigate).toHaveBeenCalledWith("AgroReportIncident", { farmId: "farm1", farmName: "Finca El Roble" });
});
