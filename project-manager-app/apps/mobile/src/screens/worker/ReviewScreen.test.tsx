import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { fetchMyBids } from "../../api/bids";
import { fetchMyRatings } from "../../api/ratings";
import { useAuth } from "../../context/AuthContext";
import ReviewScreen from "./ReviewScreen";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => require("react").useEffect(effect, []),
}));
jest.mock("../../api/bids", () => ({
  fetchMyBids: jest.fn(),
}));
jest.mock("../../api/ratings", () => ({
  fetchMyRatings: jest.fn(),
}));
jest.mock("../../context/AuthContext", () => ({ useAuth: jest.fn() }));

const navigate = jest.fn();
const mockNavigation = { navigate } as unknown as Parameters<typeof ReviewScreen>[0]["navigation"];
const mockRoute = {} as unknown as Parameters<typeof ReviewScreen>[0]["route"];

beforeEach(() => {
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue({ userId: "worker1" });
});

it("shows a completed, unrated job as reviewable and navigates to the review form", async () => {
  (fetchMyBids as jest.Mock).mockResolvedValue([
    { id: "bid1", jobId: "job1", tenantId: "t1", proOrgId: "org1", amount: 500, etaDays: 3, status: "accepted", jobStatus: "completed", jobTitle: "Reparar techo", clientUserId: "client1", clientEmail: "cliente@demo.semse" },
  ]);
  (fetchMyRatings as jest.Mock).mockResolvedValue([]);
  await render(<ReviewScreen navigation={mockNavigation} route={mockRoute} />);

  await waitFor(() => expect(screen.getByText("Reparar techo")).toBeTruthy());
  expect(screen.getByText("Calificar a cliente@demo.semse")).toBeTruthy();

  await fireEvent.press(screen.getByText("Reparar techo"));
  expect(navigate).toHaveBeenCalledWith("ReviewForm", {
    jobId: "job1",
    jobTitle: "Reparar techo",
    toUserId: "client1",
    toUserEmail: "cliente@demo.semse",
  });
});

it("excludes jobs already rated by the worker from the reviewable list", async () => {
  (fetchMyBids as jest.Mock).mockResolvedValue([
    { id: "bid1", jobId: "job1", tenantId: "t1", proOrgId: "org1", amount: 500, etaDays: 3, status: "accepted", jobStatus: "completed", jobTitle: "Reparar techo", clientUserId: "client1" },
  ]);
  (fetchMyRatings as jest.Mock).mockResolvedValue([
    { id: "r1", jobId: "job1", score: 5, createdAt: "2026-01-01T00:00:00Z", job: { id: "job1", title: "Reparar techo" }, fromUser: { id: "worker1", email: "w@demo.semse" }, toUser: { id: "client1", email: "c@demo.semse" } },
  ]);
  await render(<ReviewScreen navigation={mockNavigation} route={mockRoute} />);

  await waitFor(() => expect(screen.getByText("No tienes jobs pendientes de calificar.")).toBeTruthy());
  expect(screen.getAllByText("Reparar techo")).toHaveLength(1);
});
