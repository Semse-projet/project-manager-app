import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { createLead, fetchLeadStats, fetchLeads } from "../../api/contractor";
import AdminContractorsScreen from "./AdminContractorsScreen";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => require("react").useEffect(effect, []),
}));
jest.mock("../../api/contractor", () => ({
  fetchLeads: jest.fn(),
  fetchLeadStats: jest.fn(),
  createLead: jest.fn(),
}));

const EMPTY_STATS = { total: 0, new: 0, contacted: 0, estimate_sent: 0, estimate_approved: 0, in_progress: 0, completed: 0, lost: 0 };

beforeEach(() => {
  jest.clearAllMocks();
});

it("shows an empty state when there are no leads", async () => {
  (fetchLeads as jest.Mock).mockResolvedValue([]);
  (fetchLeadStats as jest.Mock).mockResolvedValue(EMPTY_STATS);
  await render(<AdminContractorsScreen />);
  await waitFor(() => expect(screen.getByText("No hay leads registrados todavía.")).toBeTruthy());
});

it("shows an error state when the fetch fails", async () => {
  (fetchLeads as jest.Mock).mockRejectedValue(new Error("network down"));
  (fetchLeadStats as jest.Mock).mockResolvedValue(EMPTY_STATS);
  await render(<AdminContractorsScreen />);
  await waitFor(() => expect(screen.getByText("network down")).toBeTruthy());
});

it("lists leads with their status and derives stat counts from the org-scoped stats endpoint", async () => {
  (fetchLeads as jest.Mock).mockResolvedValue([
    { id: "l1", tenantId: "t1", orgId: "o1", createdBy: "u1", name: "Juan Pérez", phone: "+15550000", jobType: "electrical", status: "new", createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-01T00:00:00Z" },
  ]);
  (fetchLeadStats as jest.Mock).mockResolvedValue({ ...EMPTY_STATS, total: 1, new: 1 });
  await render(<AdminContractorsScreen />);

  await waitFor(() => expect(screen.getByText("Juan Pérez")).toBeTruthy());
  expect(screen.getByText("Nuevo")).toBeTruthy();
  expect(screen.getByText("electrical · +15550000")).toBeTruthy();
});

it("creates a new lead from the form", async () => {
  (fetchLeads as jest.Mock).mockResolvedValue([]);
  (fetchLeadStats as jest.Mock).mockResolvedValue(EMPTY_STATS);
  (createLead as jest.Mock).mockResolvedValue({ id: "l-new" });
  await render(<AdminContractorsScreen />);
  await waitFor(() => expect(screen.getByText("+ Nuevo lead")).toBeTruthy());

  await fireEvent.press(screen.getByText("+ Nuevo lead"));
  await waitFor(() => expect(screen.getByPlaceholderText("Nombre del contacto")).toBeTruthy());

  await fireEvent.changeText(screen.getByPlaceholderText("Nombre del contacto"), "María López");
  await fireEvent.press(screen.getByText("Crear lead"));

  await waitFor(() => expect(createLead).toHaveBeenCalledWith({
    name: "María López",
    phone: undefined,
    jobType: undefined,
  }));
});

it("does not render any status-changing or estimate action", async () => {
  (fetchLeads as jest.Mock).mockResolvedValue([
    { id: "l1", tenantId: "t1", orgId: "o1", createdBy: "u1", name: "Juan Pérez", phone: null, jobType: null, status: "new", createdAt: "2026-08-01T00:00:00Z", updatedAt: "2026-08-01T00:00:00Z" },
  ]);
  (fetchLeadStats as jest.Mock).mockResolvedValue(EMPTY_STATS);
  await render(<AdminContractorsScreen />);
  await waitFor(() => expect(screen.getByText("Juan Pérez")).toBeTruthy());
  expect(screen.queryByText(/estimado/i)).toBeNull();
  expect(screen.queryByText(/eliminar/i)).toBeNull();
});
