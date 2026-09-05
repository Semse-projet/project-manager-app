import { render, screen, waitFor } from "@testing-library/react-native";
import { fetchMyBids } from "../../api/bids";
import { fetchJobPayments } from "../../api/payments";
import PaymentsScreen from "./PaymentsScreen";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => require("react").useEffect(effect, []),
}));
jest.mock("../../api/bids", () => ({
  fetchMyBids: jest.fn(),
}));
jest.mock("../../api/payments", () => ({
  fetchJobPayments: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

it("shows an empty state when there are no payments", async () => {
  (fetchMyBids as jest.Mock).mockResolvedValue([]);
  await render(<PaymentsScreen />);
  await waitFor(() => expect(screen.getByText("No tienes movimientos de pago todavía.")).toBeTruthy());
});

it("flattens payments across accepted jobs", async () => {
  (fetchMyBids as jest.Mock).mockResolvedValue([
    { id: "bid1", jobId: "job1", tenantId: "t1", proOrgId: "org1", amount: 500, etaDays: 3, status: "accepted", jobTitle: "Reparar techo" },
    { id: "bid2", jobId: "job2", tenantId: "t1", proOrgId: "org1", amount: 200, etaDays: 1, status: "submitted", jobTitle: "Propuesta pendiente" },
  ]);
  (fetchJobPayments as jest.Mock).mockImplementation((jobId: string) =>
    jobId === "job1"
      ? Promise.resolve([
          { id: "p1", tenantId: "t1", escrowId: "e1", projectId: "pr1", jobId: "job1", type: "RELEASE", amount: 500, status: "SUCCEEDED", createdAt: "2026-01-02T00:00:00Z" },
        ])
      : Promise.resolve([]),
  );
  await render(<PaymentsScreen />);

  await waitFor(() => expect(screen.getByText("Reparar techo")).toBeTruthy());
  expect(screen.getByText("RELEASE · USD 500")).toBeTruthy();
  expect(fetchJobPayments).toHaveBeenCalledWith("job1");
  expect(fetchJobPayments).not.toHaveBeenCalledWith("job2");
});
