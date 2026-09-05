import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { fetchTrustOverview } from "../../api/trust";
import AdminTrustScreen from "./AdminTrustScreen";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => require("react").useEffect(effect, []),
}));
jest.mock("../../api/trust", () => ({
  fetchTrustOverview: jest.fn(),
}));

const EMPTY_OVERVIEW = { total: 0, highRisk: 0, mediumRisk: 0, lowRisk: 0, items: [] };

beforeEach(() => {
  jest.clearAllMocks();
});

it("shows an empty state when there are no trust entries", async () => {
  (fetchTrustOverview as jest.Mock).mockResolvedValue(EMPTY_OVERVIEW);
  await render(<AdminTrustScreen />);
  await waitFor(() => expect(screen.getByText("Sin datos de trust disponibles.")).toBeTruthy());
});

it("shows an error state when the fetch fails", async () => {
  (fetchTrustOverview as jest.Mock).mockRejectedValue(new Error("network down"));
  await render(<AdminTrustScreen />);
  await waitFor(() => expect(screen.getByText("network down")).toBeTruthy());
});

it("renders stat cards and a job/project entry with its level and score", async () => {
  (fetchTrustOverview as jest.Mock).mockResolvedValue({
    total: 2, highRisk: 1, mediumRisk: 0, lowRisk: 1,
    items: [
      {
        scopeType: "job", scopeId: "job_123456789", jobId: "job_123456789", score: 88,
        level: "low", flags: [], primaryReason: "No trust issues detected", lastUpdatedAt: "2026-08-01T00:00:00Z",
      },
      {
        scopeType: "project", scopeId: "proj_987654321", jobId: "job_1", projectId: "proj_987654321", score: 22,
        level: "high", flags: ["chargeback_dispute"], primaryReason: "Multiple disputes on this project", lastUpdatedAt: "2026-08-01T00:00:00Z",
      },
    ],
  });
  await render(<AdminTrustScreen />);

  await waitFor(() => expect(screen.getByText("job: job_12345678")).toBeTruthy());
  expect(screen.getByText("project: proj_9876543")).toBeTruthy();
  expect(screen.getByText("Bajo · 88")).toBeTruthy();
  expect(screen.getByText("Alto · 22")).toBeTruthy();
  expect(screen.getByText("⚠ chargeback_dispute")).toBeTruthy();
});

it("filters entries by level", async () => {
  (fetchTrustOverview as jest.Mock).mockResolvedValue({
    total: 2, highRisk: 1, mediumRisk: 0, lowRisk: 1,
    items: [
      { scopeType: "job", scopeId: "job_a", jobId: "job_a", score: 90, level: "low", flags: [], primaryReason: "ok", lastUpdatedAt: "2026-08-01T00:00:00Z" },
      { scopeType: "job", scopeId: "job_b", jobId: "job_b", score: 10, level: "high", flags: [], primaryReason: "risky", lastUpdatedAt: "2026-08-01T00:00:00Z" },
    ],
  });
  await render(<AdminTrustScreen />);
  await waitFor(() => expect(screen.getByText("job: job_a")).toBeTruthy());

  await fireEvent.press(screen.getByText("Alto"));
  await waitFor(() => expect(screen.queryByText("job: job_a")).toBeNull());
  expect(screen.getByText("job: job_b")).toBeTruthy();
});

it("does not render a phantom critical filter or any trust-passport/mutating action", async () => {
  (fetchTrustOverview as jest.Mock).mockResolvedValue(EMPTY_OVERVIEW);
  await render(<AdminTrustScreen />);
  await waitFor(() => expect(screen.getByText("Todos")).toBeTruthy());
  expect(screen.queryByText(/crítico/i)).toBeNull();
  expect(screen.queryByText(/pasaporte/i)).toBeNull();
});
