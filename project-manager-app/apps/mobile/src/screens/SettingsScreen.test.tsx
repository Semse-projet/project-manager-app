import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { fetchProfile, updateProximityCheckInMode } from "../api/profile";
import { saveProximityMode } from "../geo/siteCache";
import { useAuth } from "../context/AuthContext";
import { readLocationPreference } from "../api/locationPreference";
import { stopProximityTracking } from "../geo/backgroundLocation";
import SettingsScreen from "./SettingsScreen";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => require("react").useEffect(effect, []),
}));
jest.mock("../api/profile", () => ({ fetchProfile: jest.fn(), updateProximityCheckInMode: jest.fn() }));
jest.mock("../geo/siteCache", () => ({ saveProximityMode: jest.fn() }));
jest.mock("../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../api/locationPreference", () => ({ readLocationPreference: jest.fn(), saveLocationPreference: jest.fn() }));
jest.mock("../geo/backgroundLocation", () => ({ stopProximityTracking: jest.fn(async () => undefined) }));

const logout = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue({ logout });
  (fetchProfile as jest.Mock).mockResolvedValue({ userId: "u1", proximityCheckInMode: "ask" });
  // BO-09 flag off (404) unless a test says otherwise: legacy profile options.
  (readLocationPreference as jest.Mock).mockResolvedValue({ kind: "disabled" });
});

it("loads the current mode from the profile and highlights it", async () => {
  await render(<SettingsScreen />);
  await waitFor(() => expect(screen.getByText("Preguntar siempre")).toBeTruthy());
});

it("selecting a different option updates the API profile and the local site cache", async () => {
  (updateProximityCheckInMode as jest.Mock).mockResolvedValue({ userId: "u1", proximityCheckInMode: "auto" });
  await render(<SettingsScreen />);
  await waitFor(() => expect(fetchProfile).toHaveBeenCalled());

  await fireEvent.press(screen.getByText("Iniciar automático"));

  await waitFor(() => expect(updateProximityCheckInMode).toHaveBeenCalledWith("auto"));
  expect(saveProximityMode).toHaveBeenCalledWith("auto");
});

it("re-selecting the already-active option is a no-op", async () => {
  await render(<SettingsScreen />);
  await waitFor(() => expect(screen.getByText("Preguntar siempre")).toBeTruthy());

  await fireEvent.press(screen.getByText("Preguntar siempre"));
  expect(updateProximityCheckInMode).not.toHaveBeenCalled();
});

it("logout button calls the auth context's logout", async () => {
  await render(<SettingsScreen />);
  await waitFor(() => expect(screen.getByText("Cerrar sesión")).toBeTruthy());

  await fireEvent.press(screen.getByText("Cerrar sesión"));
  expect(logout).toHaveBeenCalledTimes(1);
});

it("BO-09: leer ASK sobre un auto guardado lo aplica al modo de la tarea sin volver a guardar", async () => {
  (fetchProfile as jest.Mock).mockResolvedValue({ userId: "u1", proximityCheckInMode: "auto" });
  (readLocationPreference as jest.Mock).mockResolvedValue({
    kind: "ok",
    pref: { mode: "ASK", effectiveMode: "ASK", autoStartConsent: false, policyVersion: 1 },
  });
  await render(<SettingsScreen />);
  await waitFor(() => expect(saveProximityMode).toHaveBeenCalledWith("ask"));
  expect(saveProximityMode).not.toHaveBeenCalledWith("auto");
  expect(stopProximityTracking).not.toHaveBeenCalled();
});

it("BO-09 en error: muestra el error, oculta las opciones anteriores y desactiva la detección", async () => {
  (fetchProfile as jest.Mock).mockResolvedValue({ userId: "u1", proximityCheckInMode: "auto" });
  (readLocationPreference as jest.Mock).mockResolvedValue({ kind: "error", message: "503" });
  await render(<SettingsScreen />);
  await waitFor(() => expect(screen.getByText(/No se pudo leer tu preferencia de ubicación/)).toBeTruthy());
  expect(screen.queryByText("Preguntar siempre")).toBeNull();
  await waitFor(() => expect(saveProximityMode).toHaveBeenCalledWith("off"));
  expect(stopProximityTracking).toHaveBeenCalled();
});

it("elegir Desactivado detiene la ubicación en segundo plano", async () => {
  (updateProximityCheckInMode as jest.Mock).mockResolvedValue({ userId: "u1", proximityCheckInMode: "off" });
  await render(<SettingsScreen />);
  await waitFor(() => expect(screen.getByText("Desactivado")).toBeTruthy());
  await fireEvent.press(screen.getByText("Desactivado"));
  await waitFor(() => expect(saveProximityMode).toHaveBeenCalledWith("off"));
  expect(stopProximityTracking).toHaveBeenCalled();
});

it("BO-09 en OFF con el perfil caído: aplica off y no ofrece las opciones anteriores", async () => {
  (fetchProfile as jest.Mock).mockRejectedValue(new Error("perfil 503"));
  (readLocationPreference as jest.Mock).mockResolvedValue({
    kind: "ok",
    pref: { mode: "OFF", effectiveMode: "OFF", autoStartConsent: false, policyVersion: 1 },
  });
  await render(<SettingsScreen />);
  await waitFor(() => expect(saveProximityMode).toHaveBeenCalledWith("off"));
  expect(stopProximityTracking).toHaveBeenCalled();
  expect(screen.queryByText("Preguntar siempre")).toBeNull();
  expect(screen.getByText("Preguntar")).toBeTruthy();
});

it("BO-09 apagado (404) con el perfil caído: muestra el error y no ofrece opciones", async () => {
  (fetchProfile as jest.Mock).mockRejectedValue(new Error("perfil 503"));
  await render(<SettingsScreen />);
  await waitFor(() => expect(screen.getByText("perfil 503")).toBeTruthy());
  expect(screen.queryByText("Preguntar siempre")).toBeNull();
  expect(saveProximityMode).not.toHaveBeenCalled();
});
