import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { useAuth } from "../../context/AuthContext";
import AdminSettingsScreen from "./AdminSettingsScreen";

jest.mock("../../context/AuthContext", () => ({ useAuth: jest.fn() }));

const logout = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue({ logout });
});

it("logout button calls the auth context's logout", async () => {
  await render(<AdminSettingsScreen />);
  await waitFor(() => expect(screen.getByText("Cerrar sesión")).toBeTruthy());

  await fireEvent.press(screen.getByText("Cerrar sesión"));
  expect(logout).toHaveBeenCalledTimes(1);
});
