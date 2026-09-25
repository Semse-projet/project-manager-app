import { render, screen, waitFor } from "@testing-library/react-native";
import { fetchDisputes } from "../../api/disputes";
import AdminDisputeDetailScreen from "./AdminDisputeDetailScreen";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => require("react").useEffect(effect, []),
}));
jest.mock("../../api/disputes", () => ({
  fetchDisputes: jest.fn(),
}));

const mockNavigation = {} as unknown as Parameters<typeof AdminDisputeDetailScreen>[0]["navigation"];
const baseRoute = { params: { disputeId: "d1" } } as unknown as Parameters<typeof AdminDisputeDetailScreen>[0]["route"];

beforeEach(() => {
  jest.clearAllMocks();
});

it("shows the dispute reason and status", async () => {
  (fetchDisputes as jest.Mock).mockResolvedValue([
    { id: "d1", tenantId: "t1", projectId: "p1", reason: "Trabajo incompleto", status: "UNDER_REVIEW", evidenceBundleIds: [] },
  ]);
  await render(<AdminDisputeDetailScreen navigation={mockNavigation} route={baseRoute} />);

  await waitFor(() => expect(screen.getByText("Trabajo incompleto")).toBeTruthy());
  expect(screen.getByText("En revisión")).toBeTruthy();
});

it("shows the assignee when the dispute has one", async () => {
  (fetchDisputes as jest.Mock).mockResolvedValue([
    { id: "d1", tenantId: "t1", projectId: "p1", reason: "Trabajo incompleto", status: "ASSIGNED", assigneeUserId: "u_ops_1", evidenceBundleIds: [] },
  ]);
  await render(<AdminDisputeDetailScreen navigation={mockNavigation} route={baseRoute} />);

  await waitFor(() => expect(screen.getByText("u_ops_1")).toBeTruthy());
});

it("shows the resolution and type when the dispute is resolved", async () => {
  (fetchDisputes as jest.Mock).mockResolvedValue([
    { id: "d1", tenantId: "t1", projectId: "p1", reason: "Trabajo incompleto", status: "RESOLVED", resolution: "Reembolso parcial", resolutionType: "partial_50_50", evidenceBundleIds: [] },
  ]);
  await render(<AdminDisputeDetailScreen navigation={mockNavigation} route={baseRoute} />);

  await waitFor(() => expect(screen.getByText("Reembolso parcial")).toBeTruthy());
  expect(screen.getByText("Tipo: partial_50_50")).toBeTruthy();
});

it("shows a not-found error when the dispute id doesn't match", async () => {
  (fetchDisputes as jest.Mock).mockResolvedValue([]);
  await render(<AdminDisputeDetailScreen navigation={mockNavigation} route={baseRoute} />);

  await waitFor(() => expect(screen.getByText("No se encontró la disputa.")).toBeTruthy());
});

it("shows a load error when the fetch fails", async () => {
  (fetchDisputes as jest.Mock).mockRejectedValue(new Error("network down"));
  await render(<AdminDisputeDetailScreen navigation={mockNavigation} route={baseRoute} />);

  await waitFor(() => expect(screen.getByText("network down")).toBeTruthy());
});
