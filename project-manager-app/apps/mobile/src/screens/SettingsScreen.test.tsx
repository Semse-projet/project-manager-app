import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { fetchProfile, updateProximityCheckInMode } from "../api/profile";
import { saveProximityMode } from "../geo/siteCache";
import { useAuth } from "../context/AuthContext";
import SettingsScreen from "./SettingsScreen";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => require("react").useEffect(effect, []),
}));
jest.mock("../api/profile", () => ({ fetchProfile: jest.fn(), updateProximityCheckInMode: jest.fn() }));
jest.mock("../geo/siteCache", () => ({ saveProximityMode: jest.fn() }));
jest.mock("../context/AuthContext", () => ({ useAuth: jest.fn() }));

const logout = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue({ logout });
  (fetchProfile as jest.Mock).mockResolvedValue({ userId: "u1", proximityCheckInMode: "ask" });
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
