import { render, screen, waitFor } from "@testing-library/react-native";
import { fetchAdminLaborOverview } from "../../api/labor";
import AdminLaborOverviewScreen from "./AdminLaborOverviewScreen";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => require("react").useEffect(effect, []),
}));
jest.mock("../../api/labor", () => ({
  fetchAdminLaborOverview: jest.fn(),
}));

const baseOverview = {
  period: { from: "2026-08-17T00:00:00.000Z", to: "2026-08-23T23:59:59.999Z" },
  activeTimers: [],
  team: [],
  alerts: [],
  thresholds: { staleTimerHours: 12, overtimeWeekMinutes: 2880, longEntryMinutes: 720, farFromSiteMeters: 500 },
  generatedAt: "2026-08-19T00:00:00.000Z",
};

beforeEach(() => {
  jest.clearAllMocks();
});

it("shows an empty state when there are no alerts and no team activity", async () => {
  (fetchAdminLaborOverview as jest.Mock).mockResolvedValue(baseOverview);
  await render(<AdminLaborOverviewScreen />);
  await waitFor(() => expect(screen.getByText("Sin alertas ni actividad del equipo esta semana.")).toBeTruthy());
});

it("shows an error state when the fetch fails", async () => {
  (fetchAdminLaborOverview as jest.Mock).mockRejectedValue(new Error("network down"));
  await render(<AdminLaborOverviewScreen />);
  await waitFor(() => expect(screen.getByText("network down")).toBeTruthy());
});

it("renders each alert type with its severity and detail", async () => {
  (fetchAdminLaborOverview as jest.Mock).mockResolvedValue({
    ...baseOverview,
    alerts: [
      { type: "stale_timer", severity: "critical", workerId: "u_worker_1", entryId: "te_1", detail: "Timer corriendo desde hace 14h." },
      { type: "overtime", severity: "warning", workerId: "u_worker_2", detail: "50.0h esta semana." },
    ],
  });
  await render(<AdminLaborOverviewScreen />);

  await waitFor(() => expect(screen.getByText("Timer olvidado")).toBeTruthy());
  expect(screen.getByText("Crítica")).toBeTruthy();
  expect(screen.getByText("Timer corriendo desde hace 14h.")).toBeTruthy();
  expect(screen.getByText("Horas extra")).toBeTruthy();
  expect(screen.getByText("Alerta")).toBeTruthy();
});

it("renders team summary rows including a worker with no configured rate", async () => {
  (fetchAdminLaborOverview as jest.Mock).mockResolvedValue({
    ...baseOverview,
    team: [
      { workerId: "u_worker_1", totalMinutes: 120, totalEntries: 2, knownCost: 0, minutesWithoutRate: 120 },
    ],
  });
  await render(<AdminLaborOverviewScreen />);

  await waitFor(() => expect(screen.getByText("2.0h")).toBeTruthy());
  expect(screen.getByText("USD 0")).toBeTruthy();
});

it("does not render any mutating action", async () => {
  (fetchAdminLaborOverview as jest.Mock).mockResolvedValue({
    ...baseOverview,
    alerts: [{ type: "stale_timer", severity: "critical", workerId: "u_worker_1", entryId: "te_1", detail: "Timer corriendo desde hace 14h." }],
  });
  await render(<AdminLaborOverviewScreen />);
  await waitFor(() => expect(screen.getByText("Timer olvidado")).toBeTruthy());
  expect(screen.queryByText(/detener/i)).toBeNull();
  expect(screen.queryByText(/pausar/i)).toBeNull();
  expect(screen.queryByText(/editar/i)).toBeNull();
});
