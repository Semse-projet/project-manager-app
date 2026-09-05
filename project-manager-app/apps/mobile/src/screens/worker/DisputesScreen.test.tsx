import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { createDispute, fetchDisputes } from "../../api/disputes";
import DisputesScreen from "./DisputesScreen";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => require("react").useEffect(effect, []),
}));
jest.mock("../../api/disputes", () => ({
  fetchDisputes: jest.fn(),
  createDispute: jest.fn(),
}));

const navigate = jest.fn();
const mockNavigation = { navigate } as unknown as Parameters<typeof DisputesScreen>[0]["navigation"];
const mockRoute = {} as unknown as Parameters<typeof DisputesScreen>[0]["route"];

beforeEach(() => {
  jest.clearAllMocks();
});

it("shows an empty state when there are no disputes", async () => {
  (fetchDisputes as jest.Mock).mockResolvedValue([]);
  await render(<DisputesScreen navigation={mockNavigation} route={mockRoute} />);
  await waitFor(() => expect(screen.getByText("No tienes disputas.")).toBeTruthy());
});

it("lists disputes and navigates to detail on press", async () => {
  (fetchDisputes as jest.Mock).mockResolvedValue([
    { id: "d1", tenantId: "t1", projectId: "p1", reason: "Trabajo incompleto", status: "OPEN", evidenceBundleIds: [] },
  ]);
  await render(<DisputesScreen navigation={mockNavigation} route={mockRoute} />);
  await waitFor(() => expect(screen.getByText("Trabajo incompleto")).toBeTruthy());
  expect(screen.getByText("Abierta")).toBeTruthy();

  await fireEvent.press(screen.getByText("Trabajo incompleto"));
  expect(navigate).toHaveBeenCalledWith("DisputeDetail", { disputeId: "d1" });
});

it("creates a new dispute from the form", async () => {
  (fetchDisputes as jest.Mock).mockResolvedValue([]);
  (createDispute as jest.Mock).mockResolvedValue({ id: "d-new" });
  await render(<DisputesScreen navigation={mockNavigation} route={mockRoute} />);
  await waitFor(() => expect(screen.getByText("+ Abrir disputa")).toBeTruthy());

  await fireEvent.press(screen.getByText("+ Abrir disputa"));
  await waitFor(() => expect(screen.getByPlaceholderText("job_...")).toBeTruthy());

  await fireEvent.changeText(screen.getByPlaceholderText("job_..."), "job1");
  await fireEvent.changeText(
    screen.getByPlaceholderText("Describe el problema (mínimo 5 caracteres)"),
    "El cliente no pagó el anticipo acordado",
  );
  await fireEvent.press(screen.getByText("Abrir disputa"));

  await waitFor(() => expect(createDispute).toHaveBeenCalledWith({
    jobId: "job1",
    reason: "El cliente no pagó el anticipo acordado",
  }));
});
