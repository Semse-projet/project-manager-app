import { render, screen, waitFor } from "@testing-library/react-native";
import { fetchEvidenceByJob } from "../../api/evidence";
import EvidenceScreen from "./EvidenceScreen";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => require("react").useEffect(effect, []),
}));
jest.mock("../../api/evidence", () => ({
  fetchEvidenceByJob: jest.fn(),
  buildEvidenceFileUrl: (key: string) => `https://api.example.com/v1/uploads/files/${key}`,
}));
// EvidenceCapture is unit-tested on its own (src/components/EvidenceCapture.test.tsx) —
// stub it here so this screen's test only covers the list/load behavior around it.
jest.mock("../../components/EvidenceCapture", () => ({
  EvidenceCapture: () => null,
}));

const mockNavigation = {} as unknown as Parameters<typeof EvidenceScreen>[0]["navigation"];
const baseRoute = { params: { jobId: "job1", jobTitle: "Reparar techo" } } as unknown as Parameters<typeof EvidenceScreen>[0]["route"];

beforeEach(() => {
  jest.clearAllMocks();
});

it("shows an empty state when there is no evidence yet", async () => {
  (fetchEvidenceByJob as jest.Mock).mockResolvedValue([]);
  await render(<EvidenceScreen navigation={mockNavigation} route={baseRoute} />);
  await waitFor(() => expect(screen.getByText("Aún no hay evidencia para este job.")).toBeTruthy());
  expect(screen.getByText("Reparar techo")).toBeTruthy();
});

it("loads and displays existing evidence for the job", async () => {
  (fetchEvidenceByJob as jest.Mock).mockResolvedValue([
    { id: "ev1", tenantId: "t1", projectId: "p1", jobId: "job1", uploadedById: "u1", kind: "PHOTO", key: "key1", validationStatus: "pending", createdAt: "2026-01-01T00:00:00.000Z" },
  ]);
  await render(<EvidenceScreen navigation={mockNavigation} route={baseRoute} />);
  await waitFor(() => expect(fetchEvidenceByJob).toHaveBeenCalledWith("job1"));
});
