import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { useAuth } from "../context/AuthContext";
import { isAuthError } from "../api/auth";
import LoginScreen from "./LoginScreen";

jest.mock("../context/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("../api/auth", () => ({
  isAuthError: (error: unknown) => error instanceof Error && error.message === "AUTH_ERROR",
}));

const login = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue({ login });
});

it("does not submit while email/password are empty", async () => {
  await render(<LoginScreen />);

  await fireEvent.press(screen.getByText("Ingresar"));
  expect(login).not.toHaveBeenCalled();
});

it("submits trimmed email + password on press", async () => {
  login.mockResolvedValue(undefined);
  await render(<LoginScreen />);

  await fireEvent.changeText(screen.getByPlaceholderText("Correo electrónico"), "  worker@demo.semse  ");
  await fireEvent.changeText(screen.getByPlaceholderText("Contraseña"), "demo1234");
  await fireEvent.press(screen.getByText("Ingresar"));

  await waitFor(() => expect(login).toHaveBeenCalledWith("worker@demo.semse", "demo1234"));
});

it("shows an error message when login fails", async () => {
  login.mockRejectedValue(new Error("AUTH_ERROR"));
  await render(<LoginScreen />);

  await fireEvent.changeText(screen.getByPlaceholderText("Correo electrónico"), "worker@demo.semse");
  await fireEvent.changeText(screen.getByPlaceholderText("Contraseña"), "wrong");
  await fireEvent.press(screen.getByText("Ingresar"));

  await waitFor(() => expect(screen.getByText("AUTH_ERROR")).toBeTruthy());
});
