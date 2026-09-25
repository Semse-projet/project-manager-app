import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { fetchJobsList } from "../../api/jobs";
import JobsListScreen from "./JobsListScreen";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => require("react").useEffect(effect, []),
}));
jest.mock("../../api/jobs", () => ({
  fetchJobsList: jest.fn(),
}));

const navigate = jest.fn();
const mockNavigation = { navigate } as unknown as Parameters<typeof JobsListScreen>[0]["navigation"];
const mockRoute = {} as unknown as Parameters<typeof JobsListScreen>[0]["route"];

beforeEach(() => {
  jest.clearAllMocks();
});

it("shows an empty state when there are no jobs", async () => {
  (fetchJobsList as jest.Mock).mockResolvedValue([]);
  await render(<JobsListScreen navigation={mockNavigation} route={mockRoute} />);
  await waitFor(() => expect(screen.getByText("Aún no tienes jobs publicados.")).toBeTruthy());
});

it("shows an error state without crashing when the fetch fails", async () => {
  (fetchJobsList as jest.Mock).mockRejectedValue(new Error("network down"));
  await render(<JobsListScreen navigation={mockNavigation} route={mockRoute} />);
  await waitFor(() => expect(screen.getByText("network down")).toBeTruthy());
});

it("lists jobs with their status badge", async () => {
  (fetchJobsList as jest.Mock).mockResolvedValue([
    { id: "job1", tenantId: "t1", title: "Reparar techo", scope: "...", status: "posted", location: "CDMX" },
  ]);
  await render(<JobsListScreen navigation={mockNavigation} route={mockRoute} />);
  await waitFor(() => expect(screen.getByText("Reparar techo")).toBeTruthy());
  expect(screen.getByText("Publicado")).toBeTruthy();
  expect(screen.getByText("CDMX")).toBeTruthy();
});

it("navigates to JobDetail when a job card is pressed", async () => {
  (fetchJobsList as jest.Mock).mockResolvedValue([
    { id: "job1", tenantId: "t1", title: "Reparar techo", scope: "...", status: "posted" },
  ]);
  await render(<JobsListScreen navigation={mockNavigation} route={mockRoute} />);
  await waitFor(() => expect(screen.getByText("Reparar techo")).toBeTruthy());

  await fireEvent.press(screen.getByText("Reparar techo"));
  expect(navigate).toHaveBeenCalledWith("JobDetail", { jobId: "job1" });
});

it("filters jobs by tab and shows the tab's header copy", async () => {
  (fetchJobsList as jest.Mock).mockResolvedValue([
    { id: "job1", tenantId: "t1", title: "Reparar techo", scope: "...", status: "draft" },
    { id: "job2", tenantId: "t1", title: "Pintar oficina", scope: "...", status: "completed" },
  ]);
  await render(<JobsListScreen navigation={mockNavigation} route={mockRoute} />);
  await waitFor(() => expect(screen.getByText("Reparar techo")).toBeTruthy());

  await fireEvent.press(screen.getByText("Borradores"));
  expect(screen.getByText("Reparar techo")).toBeTruthy();
  expect(screen.queryByText("Pintar oficina")).toBeNull();
  expect(screen.getByText("Trabajos que todavía no publicaste.")).toBeTruthy();
});

it("does not show a header banner for the 'Todos' tab", async () => {
  (fetchJobsList as jest.Mock).mockResolvedValue([
    { id: "job1", tenantId: "t1", title: "Reparar techo", scope: "...", status: "draft" },
  ]);
  await render(<JobsListScreen navigation={mockNavigation} route={mockRoute} />);
  await waitFor(() => expect(screen.getByText("Reparar techo")).toBeTruthy());
  expect(screen.queryByText("Trabajos que todavía no publicaste.")).toBeNull();
});

it("filters jobs by search query on title", async () => {
  (fetchJobsList as jest.Mock).mockResolvedValue([
    { id: "job1", tenantId: "t1", title: "Reparar techo", scope: "...", status: "posted" },
    { id: "job2", tenantId: "t1", title: "Pintar oficina", scope: "...", status: "posted" },
  ]);
  await render(<JobsListScreen navigation={mockNavigation} route={mockRoute} />);
  await waitFor(() => expect(screen.getByText("Reparar techo")).toBeTruthy());

  await fireEvent.changeText(screen.getByPlaceholderText("Buscar trabajo..."), "techo");
  expect(screen.getByText("Reparar techo")).toBeTruthy();
  expect(screen.queryByText("Pintar oficina")).toBeNull();
});
