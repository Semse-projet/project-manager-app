import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { fetchJobsList } from "../../api/jobs";
import { navigationRef } from "../../navigation/navigationRef";
import JobsListScreen from "./JobsListScreen";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => require("react").useEffect(effect, []),
}));
jest.mock("../../api/jobs", () => ({
  fetchJobsList: jest.fn(),
}));
jest.mock("../../navigation/navigationRef", () => ({
  navigationRef: { navigate: jest.fn(), isReady: jest.fn().mockReturnValue(true) },
}));

const navigate = jest.fn();
const mockNavigation = { navigate } as unknown as Parameters<typeof JobsListScreen>[0]["navigation"];
const mockRoute = {} as unknown as Parameters<typeof JobsListScreen>[0]["route"];

beforeEach(() => {
  jest.clearAllMocks();
  (navigationRef.isReady as jest.Mock).mockReturnValue(true);
});

it("shows an empty state when there are no jobs", async () => {
  (fetchJobsList as jest.Mock).mockResolvedValue([]);
  await render(<JobsListScreen navigation={mockNavigation} route={mockRoute} />);
  await waitFor(() => expect(screen.getByText("No hay jobs disponibles todavía.")).toBeTruthy());
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

it("filters jobs by tab (Activos hides opportunities and completed jobs)", async () => {
  (fetchJobsList as jest.Mock).mockResolvedValue([
    { id: "job1", tenantId: "t1", title: "Reparar techo", scope: "...", status: "posted" },
    { id: "job2", tenantId: "t1", title: "Pintar oficina", scope: "...", status: "in_progress" },
    { id: "job3", tenantId: "t1", title: "Instalar cableado", scope: "...", status: "completed" },
  ]);
  await render(<JobsListScreen navigation={mockNavigation} route={mockRoute} />);
  await waitFor(() => expect(screen.getByText("Reparar techo")).toBeTruthy());

  await fireEvent.press(screen.getByText("Activos"));
  expect(screen.getByText("Pintar oficina")).toBeTruthy();
  expect(screen.queryByText("Reparar techo")).toBeNull();
  expect(screen.queryByText("Instalar cableado")).toBeNull();
});

it("filters jobs by search query on title", async () => {
  (fetchJobsList as jest.Mock).mockResolvedValue([
    { id: "job1", tenantId: "t1", title: "Reparar techo", scope: "...", status: "posted" },
    { id: "job2", tenantId: "t1", title: "Pintar oficina", scope: "...", status: "posted" },
  ]);
  await render(<JobsListScreen navigation={mockNavigation} route={mockRoute} />);
  await waitFor(() => expect(screen.getByText("Reparar techo")).toBeTruthy());

  await fireEvent.changeText(screen.getByPlaceholderText("Buscar jobs..."), "techo");
  expect(screen.getByText("Reparar techo")).toBeTruthy();
  expect(screen.queryByText("Pintar oficina")).toBeNull();
});

it("shows a next-action hint for a job in review", async () => {
  (fetchJobsList as jest.Mock).mockResolvedValue([
    { id: "job1", tenantId: "t1", title: "Reparar techo", scope: "...", status: "review" },
  ]);
  await render(<JobsListScreen navigation={mockNavigation} route={mockRoute} />);
  await waitFor(() =>
    expect(screen.getByText("▶ El cliente está revisando tu entrega. Espera aprobación.")).toBeTruthy(),
  );
});

it("shows a dispute banner that opens the Disputes screen when a job is disputed", async () => {
  (fetchJobsList as jest.Mock).mockResolvedValue([
    { id: "job1", tenantId: "t1", title: "Reparar techo", scope: "...", status: "dispute" },
  ]);
  await render(<JobsListScreen navigation={mockNavigation} route={mockRoute} />);
  await waitFor(() => expect(screen.getByText(/con disputa activa/)).toBeTruthy());

  await fireEvent.press(screen.getByText(/con disputa activa/));
  expect(navigationRef.navigate).toHaveBeenCalledWith("More", { screen: "Disputes" });
});

it("does not show a dispute banner when no job is disputed", async () => {
  (fetchJobsList as jest.Mock).mockResolvedValue([
    { id: "job1", tenantId: "t1", title: "Reparar techo", scope: "...", status: "posted" },
  ]);
  await render(<JobsListScreen navigation={mockNavigation} route={mockRoute} />);
  await waitFor(() => expect(screen.getByText("Reparar techo")).toBeTruthy());
  expect(screen.queryByText(/con disputa activa/)).toBeNull();
});
