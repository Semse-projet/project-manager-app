import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { fetchJobDetail } from "../../api/jobs";
import { fetchMyBids, submitBid } from "../../api/bids";
import { fetchActiveTimer, startTimer } from "../../api/labor";
import JobDetailScreen from "./JobDetailScreen";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => require("react").useEffect(effect, []),
}));
jest.mock("../../api/jobs", () => ({
  fetchJobDetail: jest.fn(),
}));
jest.mock("../../api/bids", () => ({
  fetchMyBids: jest.fn(),
  submitBid: jest.fn(),
}));
jest.mock("../../api/labor", () => ({
  fetchActiveTimer: jest.fn(),
  startTimer: jest.fn(),
}));

const navigate = jest.fn();
const mockNavigation = { navigate } as unknown as Parameters<typeof JobDetailScreen>[0]["navigation"];
const baseRoute = { params: { jobId: "job1" } } as unknown as Parameters<typeof JobDetailScreen>[0]["route"];

beforeEach(() => {
  jest.clearAllMocks();
  (fetchMyBids as jest.Mock).mockResolvedValue([]);
  (fetchActiveTimer as jest.Mock).mockResolvedValue(null);
});

it("shows job details and offers a bid form when the job is open", async () => {
  (fetchJobDetail as jest.Mock).mockResolvedValue({
    id: "job1",
    tenantId: "t1",
    title: "Reparar techo",
    scope: "Reemplazar tejas dañadas",
    status: "posted",
    location: "CDMX",
  });
  await render(<JobDetailScreen navigation={mockNavigation} route={baseRoute} />);

  expect(await screen.findByText("Reparar techo")).toBeTruthy();
  expect(screen.getByText("Reemplazar tejas dañadas")).toBeTruthy();
  expect(screen.getByText("Enviar propuesta")).toBeTruthy();
});

it("does not show a bid form when the job is not open for bidding", async () => {
  (fetchJobDetail as jest.Mock).mockResolvedValue({
    id: "job1",
    tenantId: "t1",
    title: "Reparar techo",
    scope: "Reemplazar tejas dañadas",
    status: "in_progress",
  });
  await render(<JobDetailScreen navigation={mockNavigation} route={baseRoute} />);

  await waitFor(() => expect(screen.getByText("Reparar techo")).toBeTruthy());
  expect(screen.queryByText("Monto ($)")).toBeNull();
});

it("submits a bid with the entered amount and eta", async () => {
  (fetchJobDetail as jest.Mock).mockResolvedValue({
    id: "job1",
    tenantId: "t1",
    title: "Reparar techo",
    scope: "Reemplazar tejas dañadas",
    status: "posted",
  });
  (submitBid as jest.Mock).mockResolvedValue({
    id: "bid1", jobId: "job1", tenantId: "t1", proOrgId: "org1", amount: 500, etaDays: 3, status: "submitted",
  });
  await render(<JobDetailScreen navigation={mockNavigation} route={baseRoute} />);
  await waitFor(() => expect(screen.getByText("Enviar propuesta")).toBeTruthy());

  const [amountInput, etaInput] = screen.getAllByPlaceholderText("0");
  await fireEvent.changeText(amountInput, "500");
  await fireEvent.changeText(etaInput, "3");
  await fireEvent.press(screen.getByText("Enviar propuesta"));

  await waitFor(() => expect(submitBid).toHaveBeenCalledWith("job1", { amount: 500, etaDays: 3, note: undefined }));
  await waitFor(() => expect(screen.getByText("Tu propuesta")).toBeTruthy());
  expect(screen.getByText("USD 500 · 3 días")).toBeTruthy();
});

it("shows the existing bid instead of the form when one was already submitted", async () => {
  (fetchJobDetail as jest.Mock).mockResolvedValue({
    id: "job1",
    tenantId: "t1",
    title: "Reparar techo",
    scope: "Reemplazar tejas dañadas",
    status: "posted",
  });
  (fetchMyBids as jest.Mock).mockResolvedValue([
    { id: "bid1", jobId: "job1", tenantId: "t1", proOrgId: "org1", amount: 800, etaDays: 5, status: "accepted" },
  ]);
  await render(<JobDetailScreen navigation={mockNavigation} route={baseRoute} />);

  await waitFor(() => expect(screen.getByText("Tu propuesta")).toBeTruthy());
  expect(screen.getByText("USD 800 · 5 días")).toBeTruthy();
  expect(screen.getByText("Aceptada")).toBeTruthy();
  expect(screen.queryByText("Nueva propuesta")).toBeNull();
  expect(screen.queryByText("Enviar propuesta")).toBeNull();
});

it("starts a job-linked timer from an accepted bid when no timer is running", async () => {
  (fetchJobDetail as jest.Mock).mockResolvedValue({
    id: "job1", tenantId: "t1", title: "Reparar techo", scope: "Reemplazar tejas dañadas", status: "in_progress",
  });
  (fetchMyBids as jest.Mock).mockResolvedValue([
    { id: "bid1", jobId: "job1", tenantId: "t1", proOrgId: "org1", amount: 800, etaDays: 5, status: "accepted" },
  ]);
  (startTimer as jest.Mock).mockResolvedValue({ id: "timer1", jobId: "job1", status: "running" });
  await render(<JobDetailScreen navigation={mockNavigation} route={baseRoute} />);

  await waitFor(() => expect(screen.getByText("⏱️ Iniciar reloj para este job")).toBeTruthy());
  await fireEvent.press(screen.getByText("⏱️ Iniciar reloj para este job"));

  await waitFor(() => expect(startTimer).toHaveBeenCalledWith(
    expect.objectContaining({ purpose: "job_linked", jobId: "job1" }),
  ));
  await waitFor(() => expect(screen.getByText(/Reloj iniciado para este job/)).toBeTruthy());
});

it("blocks starting a job-linked timer when one is already running elsewhere", async () => {
  (fetchJobDetail as jest.Mock).mockResolvedValue({
    id: "job1", tenantId: "t1", title: "Reparar techo", scope: "Reemplazar tejas dañadas", status: "in_progress",
  });
  (fetchMyBids as jest.Mock).mockResolvedValue([
    { id: "bid1", jobId: "job1", tenantId: "t1", proOrgId: "org1", amount: 800, etaDays: 5, status: "accepted" },
  ]);
  (fetchActiveTimer as jest.Mock).mockResolvedValue({ id: "timer1", jobId: "job2", status: "running" });
  await render(<JobDetailScreen navigation={mockNavigation} route={baseRoute} />);

  await waitFor(() => expect(screen.getByText("⏱️ Iniciar reloj para este job")).toBeTruthy());
  await fireEvent.press(screen.getByText("⏱️ Iniciar reloj para este job"));

  await waitFor(() => expect(screen.getByText(/Ya tienes un reloj corriendo en otro trabajo/)).toBeTruthy());
  expect(startTimer).not.toHaveBeenCalled();
});

it("shows a message when a job has no bid and is no longer open for bidding", async () => {
  (fetchJobDetail as jest.Mock).mockResolvedValue({
    id: "job1", tenantId: "t1", title: "Reparar techo", scope: "Reemplazar tejas dañadas", status: "completed",
  });
  await render(<JobDetailScreen navigation={mockNavigation} route={baseRoute} />);

  await waitFor(() => expect(screen.getByText("Este job ya no está disponible para nuevas propuestas.")).toBeTruthy());
});

it("navigates to the Evidence screen", async () => {
  (fetchJobDetail as jest.Mock).mockResolvedValue({
    id: "job1",
    tenantId: "t1",
    title: "Reparar techo",
    scope: "Reemplazar tejas dañadas",
    status: "posted",
  });
  await render(<JobDetailScreen navigation={mockNavigation} route={baseRoute} />);
  await waitFor(() => expect(screen.getByText("Reparar techo")).toBeTruthy());

  await fireEvent.press(screen.getByText("📷 Evidencia de este job"));
  expect(navigate).toHaveBeenCalledWith("Evidence", { jobId: "job1", jobTitle: "Reparar techo" });
});
