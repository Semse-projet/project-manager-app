import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { fetchDisputes, submitDisputeEvidence } from "../../api/disputes";
import DisputeDetailScreen from "./DisputeDetailScreen";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => require("react").useEffect(effect, []),
}));
jest.mock("../../api/disputes", () => ({
  fetchDisputes: jest.fn(),
  submitDisputeEvidence: jest.fn(),
}));

let capturedOnUploaded: ((evidence: { id: string }) => void) | null = null;
jest.mock("../../components/EvidenceCapture", () => ({
  EvidenceCapture: (props: { onUploaded: (evidence: { id: string }) => void }) => {
    capturedOnUploaded = props.onUploaded;
    return null;
  },
}));

const mockNavigation = {} as unknown as Parameters<typeof DisputeDetailScreen>[0]["navigation"];
const baseRoute = { params: { disputeId: "d1" } } as unknown as Parameters<typeof DisputeDetailScreen>[0]["route"];

beforeEach(() => {
  jest.clearAllMocks();
  capturedOnUploaded = null;
});

it("shows the dispute reason and status", async () => {
  (fetchDisputes as jest.Mock).mockResolvedValue([
    { id: "d1", tenantId: "t1", projectId: "p1", reason: "Trabajo incompleto", status: "UNDER_REVIEW", evidenceBundleIds: [] },
  ]);
  await render(<DisputeDetailScreen navigation={mockNavigation} route={baseRoute} />);

  await waitFor(() => expect(screen.getByText("Trabajo incompleto")).toBeTruthy());
  expect(screen.getByText("En revisión")).toBeTruthy();
});

it("shows the resolution when the dispute is resolved and hides the evidence uploader", async () => {
  (fetchDisputes as jest.Mock).mockResolvedValue([
    { id: "d1", tenantId: "t1", projectId: "p1", reason: "Trabajo incompleto", status: "RESOLVED", resolution: "Reembolso parcial", evidenceBundleIds: [] },
  ]);
  await render(<DisputeDetailScreen navigation={mockNavigation} route={baseRoute} />);

  await waitFor(() => expect(screen.getByText("Reembolso parcial")).toBeTruthy());
  expect(screen.queryByText("Enviar evidencia")).toBeNull();
});

it("submits collected evidence ids attached to the dispute", async () => {
  (fetchDisputes as jest.Mock).mockResolvedValue([
    { id: "d1", tenantId: "t1", projectId: "p1", reason: "Trabajo incompleto", status: "OPEN", evidenceBundleIds: [] },
  ]);
  (submitDisputeEvidence as jest.Mock).mockResolvedValue({
    id: "d1", tenantId: "t1", projectId: "p1", reason: "Trabajo incompleto", status: "UNDER_REVIEW", evidenceBundleIds: ["ev1"],
  });
  await render(<DisputeDetailScreen navigation={mockNavigation} route={baseRoute} />);
  await waitFor(() => expect(screen.getByText("Enviar evidencia")).toBeTruthy());

  await act(async () => {
    capturedOnUploaded?.({ id: "ev1" });
  });
  await waitFor(() => expect(screen.getByText("Adjuntar 1 a la disputa")).toBeTruthy());

  await fireEvent.press(screen.getByText("Adjuntar 1 a la disputa"));
  await waitFor(() => expect(submitDisputeEvidence).toHaveBeenCalledWith("d1", ["ev1"]));
  await waitFor(() => expect(screen.getByText("✅ Evidencia adjuntada.")).toBeTruthy());
});
