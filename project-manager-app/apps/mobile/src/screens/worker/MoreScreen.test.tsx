import { fireEvent, render, screen } from "@testing-library/react-native";
import { useAuth } from "../../context/AuthContext";
import MoreScreen from "./MoreScreen";

jest.mock("../../context/AuthContext", () => ({ useAuth: jest.fn() }));

const navigate = jest.fn();
const logout = jest.fn();
const mockNavigation = { navigate } as unknown as Parameters<typeof MoreScreen>[0]["navigation"];
const mockRoute = {} as unknown as Parameters<typeof MoreScreen>[0]["route"];

beforeEach(() => {
  jest.clearAllMocks();
  (useAuth as jest.Mock).mockReturnValue({ logout });
});

it("lists all menu items and navigates on press", async () => {
  await render(<MoreScreen navigation={mockNavigation} route={mockRoute} />);

  await fireEvent.press(screen.getByText("Disputas"));
  expect(navigate).toHaveBeenCalledWith("Disputes");

  await fireEvent.press(screen.getByText("Incidentes"));
  expect(navigate).toHaveBeenCalledWith("Incidents");

  await fireEvent.press(screen.getByText("Viajes"));
  expect(navigate).toHaveBeenCalledWith("Travel");

  await fireEvent.press(screen.getByText("Proyectos libres"));
  expect(navigate).toHaveBeenCalledWith("FreeProjects");

  await fireEvent.press(screen.getByText("Ajustes"));
  expect(navigate).toHaveBeenCalledWith("Settings");

  await fireEvent.press(screen.getByText("Método de cobro"));
  expect(navigate).toHaveBeenCalledWith("PayoutMethod");
});

it("logs out when the button is pressed", async () => {
  await render(<MoreScreen navigation={mockNavigation} route={mockRoute} />);
  await fireEvent.press(screen.getByText("Cerrar sesión"));
  expect(logout).toHaveBeenCalled();
});
