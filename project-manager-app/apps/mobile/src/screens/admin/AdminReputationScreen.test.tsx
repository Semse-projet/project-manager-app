import { render, screen, waitFor } from "@testing-library/react-native";
import { fetchReputationBatch } from "../../api/reputation";
import AdminReputationScreen from "./AdminReputationScreen";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => require("react").useEffect(effect, []),
}));
jest.mock("../../api/reputation", () => ({
  fetchReputationBatch: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

it("shows an empty state when no professional has a computed reputation", async () => {
  (fetchReputationBatch as jest.Mock).mockResolvedValue([]);
  await render(<AdminReputationScreen />);
  await waitFor(() => expect(screen.getByText("Sin profesionales con reputación calculada todavía.")).toBeTruthy());
});

it("shows an error state when the fetch fails", async () => {
  (fetchReputationBatch as jest.Mock).mockRejectedValue(new Error("network down"));
  await render(<AdminReputationScreen />);
  await waitFor(() => expect(screen.getByText("network down")).toBeTruthy());
});

it("renders stat cards and a professional sorted by score with tier and signals", async () => {
  (fetchReputationBatch as jest.Mock).mockResolvedValue([
    {
      userId: "usr_lowscore1", score: 40, tier: "growing",
      signals: { decayedRating: 0.6, completionRate: 0.7, disputeResilienceRate: 0.8, verificationSignal: 1, totalRatings: 5, totalJobsAsProf: 6, completedJobs: 4, disputesAgainst: 1 },
      decayHalfLifeDays: 180, algorithmVersion: "v1", computedAt: "2026-08-01T00:00:00Z",
    },
    {
      userId: "usr_highscore1", score: 92, tier: "trusted",
      signals: { decayedRating: 0.95, completionRate: 1, disputeResilienceRate: 1, verificationSignal: 1, totalRatings: 20, totalJobsAsProf: 20, completedJobs: 20, disputesAgainst: 0 },
      decayHalfLifeDays: 180, algorithmVersion: "v1", computedAt: "2026-08-01T00:00:00Z",
    },
  ]);
  await render(<AdminReputationScreen />);

  await waitFor(() => expect(screen.getByText("Trusted · 92")).toBeTruthy());
  expect(screen.getByText("Growing · 40")).toBeTruthy();
  expect(screen.getByText("20 ratings · 100% completados · 100% sin disputas")).toBeTruthy();

  // Falls back to a truncated userId (last 8 chars), matching apps/web's
  // own fallback -- the backend never populates a `user` field for this
  // endpoint.
  expect(screen.getByText("ghscore1")).toBeTruthy();
});

it("does not render any mutating or ratings-detail action", async () => {
  (fetchReputationBatch as jest.Mock).mockResolvedValue([
    {
      userId: "usr_a", score: 50, tier: "emerging",
      signals: { decayedRating: 0.5, completionRate: 0.5, disputeResilienceRate: 0.5, verificationSignal: 0.5, totalRatings: 1, totalJobsAsProf: 1, completedJobs: 1, disputesAgainst: 0 },
      decayHalfLifeDays: 180, algorithmVersion: "v1", computedAt: "2026-08-01T00:00:00Z",
    },
  ]);
  await render(<AdminReputationScreen />);
  await waitFor(() => expect(screen.getByText("Emerging · 50")).toBeTruthy());
  expect(screen.queryByText(/verificar/i)).toBeNull();
  expect(screen.queryByText(/eliminar/i)).toBeNull();
});
