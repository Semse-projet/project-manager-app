import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { createIncident, fetchMyIncidents } from "../../api/incidents";
import IncidentsScreen from "./IncidentsScreen";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => require("react").useEffect(effect, []),
}));
jest.mock("../../api/incidents", () => ({
  fetchMyIncidents: jest.fn(),
  createIncident: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

it("shows an empty state when there are no incidents", async () => {
  (fetchMyIncidents as jest.Mock).mockResolvedValue([]);
  await render(<IncidentsScreen />);
  await waitFor(() => expect(screen.getByText("No has reportado incidentes.")).toBeTruthy());
});

it("lists incidents with type, severity and status", async () => {
  (fetchMyIncidents as jest.Mock).mockResolvedValue([
    { id: "inc1", tenantId: "t1", jobId: "job1", reportedBy: "u1", type: "safety", severity: "high", status: "open", title: "Andamio inestable", description: null, resolvedAt: null, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
  ]);
  await render(<IncidentsScreen />);
  await waitFor(() => expect(screen.getByText("Andamio inestable")).toBeTruthy());
  expect(screen.getByText("Alta")).toBeTruthy();
  expect(screen.getByText("Seguridad · Abierto")).toBeTruthy();
});

it("creates a new incident from the form", async () => {
  (fetchMyIncidents as jest.Mock).mockResolvedValue([]);
  (createIncident as jest.Mock).mockResolvedValue({ id: "inc-new" });
  await render(<IncidentsScreen />);
  await waitFor(() => expect(screen.getByText("+ Reportar incidente")).toBeTruthy());

  await fireEvent.press(screen.getByText("+ Reportar incidente"));
  await waitFor(() => expect(screen.getByPlaceholderText("job_...")).toBeTruthy());

  await fireEvent.changeText(screen.getByPlaceholderText("job_..."), "job1");
  await fireEvent.changeText(screen.getByPlaceholderText("Resumen breve del incidente"), "Cable expuesto");
  await fireEvent.press(screen.getByText("Reportar incidente"));

  await waitFor(() => expect(createIncident).toHaveBeenCalledWith(expect.objectContaining({
    jobId: "job1",
    title: "Cable expuesto",
    type: "other",
    severity: "medium",
  })));
});
