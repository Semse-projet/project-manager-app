import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { fetchDisputes } from "../../api/disputes";
import AdminDisputesScreen from "./AdminDisputesScreen";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => require("react").useEffect(effect, []),
}));
jest.mock("../../api/disputes", () => ({
  fetchDisputes: jest.fn(),
}));

const navigate = jest.fn();
const mockNavigation = { navigate } as unknown as Parameters<typeof AdminDisputesScreen>[0]["navigation"];
const mockRoute = {} as unknown as Parameters<typeof AdminDisputesScreen>[0]["route"];

beforeEach(() => {
  jest.clearAllMocks();
});

it("shows an empty state when the tenant has no disputes", async () => {
  (fetchDisputes as jest.Mock).mockResolvedValue([]);
  await render(<AdminDisputesScreen navigation={mockNavigation} route={mockRoute} />);
  await waitFor(() => expect(screen.getByText("Sin disputas en el tenant.")).toBeTruthy());
});

it("shows an error state when the fetch fails", async () => {
  (fetchDisputes as jest.Mock).mockRejectedValue(new Error("network down"));
  await render(<AdminDisputesScreen navigation={mockNavigation} route={mockRoute} />);
  await waitFor(() => expect(screen.getByText("network down")).toBeTruthy());
});

it("lists disputes across orgs and navigates to detail on press", async () => {
  (fetchDisputes as jest.Mock).mockResolvedValue([
    { id: "d1", tenantId: "t1", projectId: "p1", reason: "Trabajo incompleto (org A)", status: "OPEN", evidenceBundleIds: [] },
    { id: "d2", tenantId: "t1", projectId: "p2", reason: "Pago no liberado (org B)", status: "RESOLVED", resolution: "ok", evidenceBundleIds: [] },
  ]);
  await render(<AdminDisputesScreen navigation={mockNavigation} route={mockRoute} />);
  await waitFor(() => expect(screen.getByText("Trabajo incompleto (org A)")).toBeTruthy());
  expect(screen.getByText("Pago no liberado (org B)")).toBeTruthy();
  expect(screen.getByText("Abierta")).toBeTruthy();
  expect(screen.getByText("Resuelta")).toBeTruthy();

  await fireEvent.press(screen.getByText("Trabajo incompleto (org A)"));
  expect(navigate).toHaveBeenCalledWith("DisputeDetail", { disputeId: "d1" });
});

it("does not render any mutating action (assign/resolve/create)", async () => {
  (fetchDisputes as jest.Mock).mockResolvedValue([
    { id: "d1", tenantId: "t1", projectId: "p1", reason: "Trabajo incompleto", status: "OPEN", evidenceBundleIds: [] },
  ]);
  await render(<AdminDisputesScreen navigation={mockNavigation} route={mockRoute} />);
  await waitFor(() => expect(screen.getByText("Trabajo incompleto")).toBeTruthy());
  expect(screen.queryByText(/abrir disputa/i)).toBeNull();
  expect(screen.queryByText(/asignar/i)).toBeNull();
  expect(screen.queryByText(/resolver/i)).toBeNull();
});
