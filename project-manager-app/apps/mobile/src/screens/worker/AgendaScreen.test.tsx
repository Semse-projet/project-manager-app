import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { fetchJobsList } from "../../api/jobs";
import AgendaScreen from "./AgendaScreen";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => require("react").useEffect(effect, []),
}));
jest.mock("../../api/jobs", () => ({
  fetchJobsList: jest.fn(),
}));

const navigate = jest.fn();
const getParent = jest.fn(() => ({ navigate }));
const mockNavigation = { getParent } as unknown as Parameters<typeof AgendaScreen>[0]["navigation"];
const mockRoute = {} as unknown as Parameters<typeof AgendaScreen>[0]["route"];

beforeEach(() => {
  jest.clearAllMocks();
});

it("shows an empty state when there are no active jobs", async () => {
  (fetchJobsList as jest.Mock).mockResolvedValue([]);
  await render(<AgendaScreen navigation={mockNavigation} route={mockRoute} />);
  await waitFor(() => expect(screen.getByText("No tienes jobs activos en tu agenda.")).toBeTruthy());
});

it("filters out non-active jobs and navigates to the job's detail on press", async () => {
  (fetchJobsList as jest.Mock).mockResolvedValue([
    { id: "job1", tenantId: "t1", title: "Reparar techo", scope: "...", status: "in_progress", location: "CDMX", createdAt: "2026-01-15T00:00:00Z" },
    { id: "job2", tenantId: "t1", title: "Job cancelado", scope: "...", status: "cancelled", createdAt: "2026-01-15T00:00:00Z" },
  ]);
  await render(<AgendaScreen navigation={mockNavigation} route={mockRoute} />);
  await waitFor(() => expect(screen.getByText("Reparar techo")).toBeTruthy());
  expect(screen.queryByText("Job cancelado")).toBeNull();

  await fireEvent.press(screen.getByText("Reparar techo"));
  expect(navigate).toHaveBeenCalledWith("Jobs", { screen: "JobDetail", params: { jobId: "job1" } });
});
