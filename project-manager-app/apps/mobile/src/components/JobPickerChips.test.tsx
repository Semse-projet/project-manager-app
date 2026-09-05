import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { fetchMyBids } from "../api/bids";
import { JobPickerChips } from "./JobPickerChips";

jest.mock("../api/bids", () => ({
  fetchMyBids: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

it("shows a message when the worker has no accepted jobs", async () => {
  (fetchMyBids as jest.Mock).mockResolvedValue([]);
  const onSelect = jest.fn();
  await render(<JobPickerChips selectedJobId="" onSelect={onSelect} />);
  await waitFor(() => expect(screen.getByText("No tienes jobs asignados todavía.")).toBeTruthy());
});

it("lists only accepted jobs and calls onSelect with jobId and title", async () => {
  (fetchMyBids as jest.Mock).mockResolvedValue([
    { id: "bid1", jobId: "job1", tenantId: "t1", proOrgId: "org1", amount: 500, etaDays: 3, status: "accepted", jobTitle: "Reparar techo" },
    { id: "bid2", jobId: "job2", tenantId: "t1", proOrgId: "org1", amount: 200, etaDays: 1, status: "submitted", jobTitle: "Propuesta pendiente" },
  ]);
  const onSelect = jest.fn();
  await render(<JobPickerChips selectedJobId="" onSelect={onSelect} />);

  await waitFor(() => expect(screen.getByText("Reparar techo")).toBeTruthy());
  expect(screen.queryByText("Propuesta pendiente")).toBeNull();

  await fireEvent.press(screen.getByText("Reparar techo"));
  expect(onSelect).toHaveBeenCalledWith("job1", "Reparar techo");
});
