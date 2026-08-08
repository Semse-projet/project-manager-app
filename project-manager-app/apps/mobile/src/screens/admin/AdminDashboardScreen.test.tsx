import { render, screen, waitFor } from "@testing-library/react-native";
import { fetchJobsList } from "../../api/jobs";
import AdminDashboardScreen from "./AdminDashboardScreen";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => require("react").useEffect(effect, []),
}));
jest.mock("../../api/jobs", () => ({
  fetchJobsList: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

it("shows zeroed stats and no alerts when there are no jobs", async () => {
  (fetchJobsList as jest.Mock).mockResolvedValue([]);
  await render(<AdminDashboardScreen />);
  await waitFor(() => expect(screen.getByText("Sin alertas activas.")).toBeTruthy());
  expect(screen.getAllByText("0")).toHaveLength(4);
});

it("derives stat counts and dispute alerts from the jobs list", async () => {
  (fetchJobsList as jest.Mock).mockResolvedValue([
    { id: "j1", tenantId: "t1", title: "Job activo", scope: "...", status: "in_progress", budgetMin: 500 },
    { id: "j2", tenantId: "t1", title: "Job en disputa", scope: "...", status: "dispute" },
    { id: "j3", tenantId: "t1", title: "Job listo", scope: "...", status: "completed" },
  ]);
  await render(<AdminDashboardScreen />);

  await waitFor(() => expect(screen.getByText("⚠ Disputa activa: Job en disputa")).toBeTruthy());
  expect(screen.getByText("Trabajos activos")).toBeTruthy();
  expect(screen.getByText("USD 500")).toBeTruthy();
});
