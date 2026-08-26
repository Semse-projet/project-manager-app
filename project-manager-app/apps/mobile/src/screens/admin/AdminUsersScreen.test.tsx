import { render, screen, waitFor } from "@testing-library/react-native";
import { fetchUsers } from "../../api/users";
import AdminUsersScreen from "./AdminUsersScreen";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => require("react").useEffect(effect, []),
}));
jest.mock("../../api/users", () => ({
  fetchUsers: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

it("shows an empty state when the tenant has no users", async () => {
  (fetchUsers as jest.Mock).mockResolvedValue([]);
  await render(<AdminUsersScreen />);
  await waitFor(() => expect(screen.getByText("Sin usuarios en el tenant.")).toBeTruthy());
});

it("shows an error state when the fetch fails", async () => {
  (fetchUsers as jest.Mock).mockRejectedValue(new Error("network down"));
  await render(<AdminUsersScreen />);
  await waitFor(() => expect(screen.getByText("network down")).toBeTruthy());
});

it("renders a user across roles with status, verification and trust score", async () => {
  (fetchUsers as jest.Mock).mockResolvedValue([
    {
      id: "u1", email: "pro@demo.semse", phone: "+1 555 0100", status: "active",
      verificationStatus: "verified", trustScore: 0.88, riskLevel: "low", flags: [],
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ]);
  await render(<AdminUsersScreen />);

  await waitFor(() => expect(screen.getByText("pro@demo.semse")).toBeTruthy());
  expect(screen.getByText("+1 555 0100")).toBeTruthy();
  expect(screen.getByText("ACTIVE")).toBeTruthy();
  expect(screen.getByText("Verificación: verified")).toBeTruthy();
  expect(screen.getByText("88%")).toBeTruthy();
  expect(screen.getByText("LOW")).toBeTruthy();
});

it("renders a user with no phone and no flags without crashing", async () => {
  (fetchUsers as jest.Mock).mockResolvedValue([
    {
      id: "u2", email: "client@demo.semse", status: "pending",
      verificationStatus: "unverified", trustScore: 0, riskLevel: "unknown", flags: [],
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ]);
  await render(<AdminUsersScreen />);

  await waitFor(() => expect(screen.getByText("client@demo.semse")).toBeTruthy());
  expect(screen.getByText("PENDING")).toBeTruthy();
});

it("shows flags when present", async () => {
  (fetchUsers as jest.Mock).mockResolvedValue([
    {
      id: "u3", email: "risky@demo.semse", status: "suspended",
      verificationStatus: "unverified", trustScore: 0.1, riskLevel: "high",
      flags: ["chargeback_dispute"],
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ]);
  await render(<AdminUsersScreen />);

  await waitFor(() => expect(screen.getByText("⚠ chargeback_dispute")).toBeTruthy());
  expect(screen.getByText("SUSPENDED")).toBeTruthy();
});

it("does not render any mutating action (status/verify/edit)", async () => {
  (fetchUsers as jest.Mock).mockResolvedValue([
    {
      id: "u1", email: "pro@demo.semse", status: "active",
      verificationStatus: "verified", trustScore: 0.5, riskLevel: "low", flags: [],
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ]);
  await render(<AdminUsersScreen />);
  await waitFor(() => expect(screen.getByText("pro@demo.semse")).toBeTruthy());
  expect(screen.queryByText(/suspender/i)).toBeNull();
  expect(screen.queryByText(/verificar/i)).toBeNull();
  expect(screen.queryByText(/editar/i)).toBeNull();
});
