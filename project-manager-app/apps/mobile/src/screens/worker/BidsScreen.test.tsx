import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { fetchMyBids } from "../../api/bids";
import BidsScreen from "./BidsScreen";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => require("react").useEffect(effect, []),
}));
jest.mock("../../api/bids", () => ({
  fetchMyBids: jest.fn(),
}));

const navigate = jest.fn();
const mockNavigation = { navigate } as unknown as Parameters<typeof BidsScreen>[0]["navigation"];
const mockRoute = {} as unknown as Parameters<typeof BidsScreen>[0]["route"];

beforeEach(() => {
  jest.clearAllMocks();
});

it("shows an empty state when there are no bids", async () => {
  (fetchMyBids as jest.Mock).mockResolvedValue([]);
  await render(<BidsScreen navigation={mockNavigation} route={mockRoute} />);
  await waitFor(() => expect(screen.getByText("Aún no has enviado propuestas.")).toBeTruthy());
});

it("lists bids with amount, eta and status", async () => {
  (fetchMyBids as jest.Mock).mockResolvedValue([
    { id: "bid1", jobId: "job1", tenantId: "t1", proOrgId: "org1", amount: 500, etaDays: 3, status: "accepted", jobTitle: "Reparar techo" },
  ]);
  await render(<BidsScreen navigation={mockNavigation} route={mockRoute} />);
  await waitFor(() => expect(screen.getByText("Reparar techo")).toBeTruthy());
  expect(screen.getByText("USD 500 · 3 días")).toBeTruthy();
  expect(screen.getByText("Aceptada")).toBeTruthy();
});

it("navigates to the job's detail screen when a bid card is pressed", async () => {
  (fetchMyBids as jest.Mock).mockResolvedValue([
    { id: "bid1", jobId: "job1", tenantId: "t1", proOrgId: "org1", amount: 500, etaDays: 3, status: "accepted", jobTitle: "Reparar techo" },
  ]);
  await render(<BidsScreen navigation={mockNavigation} route={mockRoute} />);
  await waitFor(() => expect(screen.getByText("Reparar techo")).toBeTruthy());

  await fireEvent.press(screen.getByText("Reparar techo"));
  expect(navigate).toHaveBeenCalledWith("Jobs", { screen: "JobDetail", params: { jobId: "job1" } });
});
