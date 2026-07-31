import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { fetchActiveTimer, startTimer, stopTimer } from "../api/labor";
import {
  isProximityTrackingActive,
  requestProximityPermissions,
  startProximityTracking,
  stopProximityTracking,
} from "../geo/backgroundLocation";
import { refreshProximitySites } from "../geo/refreshSites";
import { loadProximityMode } from "../geo/siteCache";
import { registerProximityNotificationCategory, requestNotificationPermissions } from "../notifications/notifications";
import TimerScreen from "./TimerScreen";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => require("react").useEffect(effect, []),
}));
jest.mock("../api/labor", () => ({ fetchActiveTimer: jest.fn(), startTimer: jest.fn(), stopTimer: jest.fn() }));
jest.mock("../geo/backgroundLocation", () => ({
  isProximityTrackingActive: jest.fn(),
  requestProximityPermissions: jest.fn(),
  startProximityTracking: jest.fn(),
  stopProximityTracking: jest.fn(),
}));
jest.mock("../geo/refreshSites", () => ({ refreshProximitySites: jest.fn() }));
jest.mock("../geo/siteCache", () => ({ loadProximityMode: jest.fn() }));
jest.mock("../notifications/notifications", () => ({
  registerProximityNotificationCategory: jest.fn(),
  requestNotificationPermissions: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  (fetchActiveTimer as jest.Mock).mockResolvedValue(null);
  (refreshProximitySites as jest.Mock).mockResolvedValue(undefined);
  (isProximityTrackingActive as jest.Mock).mockResolvedValue(false);
});

it("shows no active session and an Iniciar button when nothing is running", async () => {
  await render(<TimerScreen />);
  await waitFor(() => expect(screen.getByText("Sin sesión activa")).toBeTruthy());
  expect(screen.getByText("Iniciar (solo calcular)")).toBeTruthy();
});

it("starting a timer calls the API and flips to the running state", async () => {
  (startTimer as jest.Mock).mockResolvedValue({ id: "te1", status: "running", purpose: "personal", jobId: null, freeProjectId: null, startedAt: new Date().toISOString() });
  await render(<TimerScreen />);
  await waitFor(() => expect(screen.getByText("Iniciar (solo calcular)")).toBeTruthy());

  await fireEvent.press(screen.getByText("Iniciar (solo calcular)"));

  await waitFor(() => expect(screen.getByText("Corriendo")).toBeTruthy());
  expect(startTimer).toHaveBeenCalledWith(expect.objectContaining({ purpose: "personal" }));
});

it("shows the running state from a pre-existing active timer and stops it", async () => {
  (fetchActiveTimer as jest.Mock).mockResolvedValue({
    id: "te1", status: "running", purpose: "personal", jobId: null, freeProjectId: null, startedAt: new Date().toISOString(),
  });
  (stopTimer as jest.Mock).mockResolvedValue(null);
  await render(<TimerScreen />);

  await waitFor(() => expect(screen.getByText("Corriendo")).toBeTruthy());
  await fireEvent.press(screen.getByText("Detener"));

  await waitFor(() => expect(stopTimer).toHaveBeenCalledWith("te1"));
  await waitFor(() => expect(screen.getByText("Sin sesión activa")).toBeTruthy());
});

it("refuses to enable proximity tracking when the profile mode is off", async () => {
  (loadProximityMode as jest.Mock).mockResolvedValue("off");
  await render(<TimerScreen />);
  await waitFor(() => expect(screen.getByText("Sin sesión activa")).toBeTruthy());

  await fireEvent(screen.getByRole("switch"), "valueChange", true);

  await waitFor(() =>
    expect(screen.getByText(/está "Desactivado" en Ajustes/)).toBeTruthy(),
  );
  expect(requestProximityPermissions).not.toHaveBeenCalled();
  expect(startProximityTracking).not.toHaveBeenCalled();
});

it("enables proximity tracking when permissions are granted", async () => {
  (loadProximityMode as jest.Mock).mockResolvedValue("ask");
  (requestProximityPermissions as jest.Mock).mockResolvedValue({ granted: true });
  (requestNotificationPermissions as jest.Mock).mockResolvedValue(true);
  await render(<TimerScreen />);
  await waitFor(() => expect(screen.getByText("Sin sesión activa")).toBeTruthy());

  await fireEvent(screen.getByRole("switch"), "valueChange", true);

  await waitFor(() => expect(startProximityTracking).toHaveBeenCalledTimes(1));
  expect(registerProximityNotificationCategory).toHaveBeenCalledTimes(1);
});
