import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import LiveSessionScreen from "./LiveSessionScreen";
import { getLiveSession, transitionLiveSession, getLiveSessionMediaToken } from "../api/liveSessions";

jest.mock("../api/liveSessions", () => ({
  getLiveSession: jest.fn(),
  transitionLiveSession: jest.fn(),
  markLiveSessionReady: jest.fn(),
  getLiveSessionMediaToken: jest.fn(),
}));
jest.mock("../context/AuthContext", () => ({ useAuth: () => ({ userId: "u_client" }) }));
jest.mock("expo-constants", () => ({ appOwnership: "expo" })); // simulate Expo Go

const routeFor = (sessionId = "ls1") =>
  ({ params: { sessionId } }) as unknown as Parameters<typeof LiveSessionScreen>[0]["route"];

const baseSession = {
  id: "ls1", tenantId: "t1", scopeType: "job", scopeId: "job_1", purpose: "inspection",
  status: "REQUESTED", version: 0, createdById: "u_client", expiresAt: null, endedAt: null,
  createdAt: "2026-09-08T00:00:00.000Z",
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});
afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

it("renders the session status", async () => {
  (getLiveSession as jest.Mock).mockResolvedValue(baseSession);
  await render(<LiveSessionScreen route={routeFor()} />);
  await waitFor(() => expect(screen.getByText("Solicitada")).toBeTruthy());
});

it("shows 'esta sesión no está disponible' on a 404", async () => {
  (getLiveSession as jest.Mock).mockRejectedValue(new Error("live session not found"));
  await render(<LiveSessionScreen route={routeFor()} />);
  await waitFor(() => expect(screen.getByText("Esta sesión no está disponible.")).toBeTruthy());
});

it("the owner does NOT get an Aceptar button (accept is for the counterparty)", async () => {
  (getLiveSession as jest.Mock).mockResolvedValue(baseSession);
  await render(<LiveSessionScreen route={routeFor()} />);
  await waitFor(() => expect(screen.getByText("Solicitada")).toBeTruthy());
  expect(screen.queryByText("Aceptar")).toBeNull();
  // owner in a pre-ACTIVE state gets Cancelar
  expect(screen.getByText("Cancelar")).toBeTruthy();
});

it("cancel calls transitionLiveSession with the current version", async () => {
  (getLiveSession as jest.Mock).mockResolvedValue(baseSession);
  (transitionLiveSession as jest.Mock).mockResolvedValue({ ...baseSession, status: "CANCELLED", version: 1 });
  await render(<LiveSessionScreen route={routeFor()} />);
  await waitFor(() => expect(screen.getByText("Cancelar")).toBeTruthy());
  await fireEvent.press(screen.getByText("Cancelar"));
  await waitFor(() => expect(transitionLiveSession).toHaveBeenCalledWith("ls1", "cancel", 0));
});

it("in Expo Go, 'Unirse al video' does NOT request a media token", async () => {
  (getLiveSession as jest.Mock).mockResolvedValue({ ...baseSession, status: "ACTIVE", version: 3 });
  await render(<LiveSessionScreen route={routeFor()} />);
  await waitFor(() => expect(screen.getByText("En vivo")).toBeTruthy());
  await fireEvent.press(screen.getByText("Unirse al video"));
  expect(getLiveSessionMediaToken).not.toHaveBeenCalled();
  expect(screen.getByText(/Estás en Expo Go/)).toBeTruthy();
});
