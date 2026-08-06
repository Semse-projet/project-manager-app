import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { createMaterialRequest, fetchMyMaterialRequests } from "../../api/materials";
import MaterialsScreen from "./MaterialsScreen";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => require("react").useEffect(effect, []),
}));
jest.mock("../../api/materials", () => ({
  fetchMyMaterialRequests: jest.fn(),
  createMaterialRequest: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

it("shows an empty state when there are no requests", async () => {
  (fetchMyMaterialRequests as jest.Mock).mockResolvedValue([]);
  await render(<MaterialsScreen />);
  await waitFor(() => expect(screen.getByText("No has solicitado materiales.")).toBeTruthy());
});

it("lists requests with quantity, unit and status", async () => {
  (fetchMyMaterialRequests as jest.Mock).mockResolvedValue([
    { id: "m1", tenantId: "t1", jobId: "job1", requestedBy: "u1", milestone: null, item: "Cemento", quantity: 10, unit: "bultos", estimatedCost: 500, status: "pending", approvedBy: null, approvedAt: null, notes: null, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" },
  ]);
  await render(<MaterialsScreen />);
  await waitFor(() => expect(screen.getByText("Cemento")).toBeTruthy());
  expect(screen.getByText("Pendiente")).toBeTruthy();
  expect(screen.getByText("10 bultos · USD 500")).toBeTruthy();
});

it("creates a new material request from the form", async () => {
  (fetchMyMaterialRequests as jest.Mock).mockResolvedValue([]);
  (createMaterialRequest as jest.Mock).mockResolvedValue({ id: "m-new" });
  await render(<MaterialsScreen />);
  await waitFor(() => expect(screen.getByText("+ Solicitar material")).toBeTruthy());

  await fireEvent.press(screen.getByText("+ Solicitar material"));
  await waitFor(() => expect(screen.getByPlaceholderText("job_...")).toBeTruthy());

  await fireEvent.changeText(screen.getByPlaceholderText("job_..."), "job1");
  await fireEvent.changeText(screen.getByPlaceholderText("Ej. Cemento"), "Arena");
  await fireEvent.changeText(screen.getAllByPlaceholderText("0")[0], "5");
  await fireEvent.changeText(screen.getByPlaceholderText("bultos, m2..."), "m3");
  await fireEvent.press(screen.getByText("Enviar solicitud"));

  await waitFor(() => expect(createMaterialRequest).toHaveBeenCalledWith(expect.objectContaining({
    jobId: "job1",
    item: "Arena",
    quantity: 5,
    unit: "m3",
  })));
});
