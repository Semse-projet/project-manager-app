import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { fetchJobDetail } from "../../api/jobs";
import { acceptBid, fetchJobBids } from "../../api/bids";
import { approveMilestone, fetchMilestonesByJob } from "../../api/milestones";
import { fetchEvidenceByJob } from "../../api/evidence";
import JobDetailScreen from "./JobDetailScreen";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => require("react").useEffect(effect, []),
}));
jest.mock("../../api/jobs", () => ({ fetchJobDetail: jest.fn() }));
jest.mock("../../api/bids", () => ({ fetchJobBids: jest.fn(), acceptBid: jest.fn() }));
jest.mock("../../api/milestones", () => ({ fetchMilestonesByJob: jest.fn(), approveMilestone: jest.fn() }));
jest.mock("../../api/evidence", () => ({
  fetchEvidenceByJob: jest.fn(),
  buildEvidenceFileUrl: (key: string) => `https://api.example.com/v1/uploads/files/${key}`,
}));

const navigate = jest.fn();
const mockNavigation = { navigate } as unknown as Parameters<typeof JobDetailScreen>[0]["navigation"];
const baseJob = { id: "job1", tenantId: "t1", title: "Reparar techo", scope: "Cambiar tejas rotas", status: "posted" };

function mockRoute(jobId = "job1") {
  return { params: { jobId } } as unknown as Parameters<typeof JobDetailScreen>[0]["route"];
}

beforeEach(() => {
  jest.clearAllMocks();
  (fetchMilestonesByJob as jest.Mock).mockResolvedValue([]);
  (fetchEvidenceByJob as jest.Mock).mockResolvedValue([]);
  (fetchJobBids as jest.Mock).mockResolvedValue([]);
});

it("shows the job title, status and scope", async () => {
  (fetchJobDetail as jest.Mock).mockResolvedValue(baseJob);
  await render(<JobDetailScreen navigation={mockNavigation} route={mockRoute()} />);
  await waitFor(() => expect(screen.getByText("Reparar techo")).toBeTruthy());
  expect(screen.getByText("Publicado")).toBeTruthy();
  expect(screen.getByText("Cambiar tejas rotas")).toBeTruthy();
});

it("shows an empty hint when there are no bids yet", async () => {
  (fetchJobDetail as jest.Mock).mockResolvedValue(baseJob);
  await render(<JobDetailScreen navigation={mockNavigation} route={mockRoute()} />);
  await waitFor(() => expect(screen.getByText("Todavía no llegaron propuestas para este job.")).toBeTruthy());
});

it("accepts a submitted bid and reloads", async () => {
  (fetchJobDetail as jest.Mock).mockResolvedValue(baseJob);
  (fetchJobBids as jest.Mock).mockResolvedValue([
    { id: "bid1", jobId: "job1", tenantId: "t1", proOrgId: "org1", amount: 500, etaDays: 3, status: "submitted", proEmail: "pro@demo.semse" },
  ]);
  (acceptBid as jest.Mock).mockResolvedValue({});

  await render(<JobDetailScreen navigation={mockNavigation} route={mockRoute()} />);
  await waitFor(() => expect(screen.getByText("pro@demo.semse")).toBeTruthy());
  expect(screen.getByText("Enviada")).toBeTruthy();

  await fireEvent.press(screen.getByText("Aceptar propuesta"));
  await waitFor(() => expect(acceptBid).toHaveBeenCalledWith("bid1"));
  await waitFor(() => expect(fetchJobBids).toHaveBeenCalledTimes(2));
});

it("does not show an accept button for a bid that is not submitted", async () => {
  (fetchJobDetail as jest.Mock).mockResolvedValue(baseJob);
  (fetchJobBids as jest.Mock).mockResolvedValue([
    { id: "bid1", jobId: "job1", tenantId: "t1", proOrgId: "org1", amount: 500, etaDays: 3, status: "rejected", proEmail: "pro@demo.semse" },
  ]);

  await render(<JobDetailScreen navigation={mockNavigation} route={mockRoute()} />);
  await waitFor(() => expect(screen.getByText("pro@demo.semse")).toBeTruthy());
  expect(screen.queryByText("Aceptar propuesta")).toBeNull();
});

it("approves a submitted milestone and reloads", async () => {
  (fetchJobDetail as jest.Mock).mockResolvedValue(baseJob);
  (fetchMilestonesByJob as jest.Mock).mockResolvedValue([
    { id: "ms1", tenantId: "t1", projectId: "p1", title: "Demolición", amount: 200, sequence: 1, status: "submitted" },
  ]);
  (approveMilestone as jest.Mock).mockResolvedValue({});

  await render(<JobDetailScreen navigation={mockNavigation} route={mockRoute()} />);
  await waitFor(() => expect(screen.getByText("Demolición")).toBeTruthy());
  expect(screen.getByText("Enviado para revisión")).toBeTruthy();

  await fireEvent.press(screen.getByText("Aprobar"));
  await waitFor(() => expect(approveMilestone).toHaveBeenCalledWith("ms1"));
  await waitFor(() => expect(fetchMilestonesByJob).toHaveBeenCalledTimes(2));
});

it("shows a rating button once the job is completed and has an accepted bid", async () => {
  (fetchJobDetail as jest.Mock).mockResolvedValue({ ...baseJob, status: "completed" });
  (fetchJobBids as jest.Mock).mockResolvedValue([
    { id: "bid1", jobId: "job1", tenantId: "t1", proOrgId: "org1", amount: 500, etaDays: 3, status: "accepted", proEmail: "pro@demo.semse", professionalUserId: "usr_pro" },
  ]);

  await render(<JobDetailScreen navigation={mockNavigation} route={mockRoute()} />);
  await waitFor(() => expect(screen.getByText("⭐ Calificar al profesional")).toBeTruthy());

  await fireEvent.press(screen.getByText("⭐ Calificar al profesional"));
  expect(navigate).toHaveBeenCalledWith("Rating", {
    jobId: "job1",
    jobTitle: "Reparar techo",
    toUserId: "usr_pro",
    toUserEmail: "pro@demo.semse",
  });
});

it("does not show a rating button when the job is completed but had no accepted bid", async () => {
  (fetchJobDetail as jest.Mock).mockResolvedValue({ ...baseJob, status: "completed" });
  await render(<JobDetailScreen navigation={mockNavigation} route={mockRoute()} />);
  await waitFor(() => expect(screen.getByText("Reparar techo")).toBeTruthy());
  expect(screen.queryByText("⭐ Calificar al profesional")).toBeNull();
});
