import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { fetchAgroMemberships } from "../../api/agro";
import AgroFarmsScreen from "./AgroFarmsScreen";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => require("react").useEffect(effect, []),
}));
jest.mock("../../api/agro", () => ({
  fetchAgroMemberships: jest.fn(),
}));

const navigate = jest.fn();
const mockNavigation = { navigate } as unknown as Parameters<typeof AgroFarmsScreen>[0]["navigation"];
const mockRoute = {} as unknown as Parameters<typeof AgroFarmsScreen>[0]["route"];

beforeEach(() => {
  jest.clearAllMocks();
});

it("shows an honest empty state when the user has no farm memberships", async () => {
  (fetchAgroMemberships as jest.Mock).mockResolvedValue([]);
  await render(<AgroFarmsScreen navigation={mockNavigation} route={mockRoute} />);
  await waitFor(() => expect(screen.getByText("No estás asignado a ninguna finca todavía.")).toBeTruthy());
});

it("lists farms and navigates to incidents on press", async () => {
  (fetchAgroMemberships as jest.Mock).mockResolvedValue([
    { farmId: "farm1", farmName: "Finca El Roble", farmRole: "WORKER" },
  ]);
  await render(<AgroFarmsScreen navigation={mockNavigation} route={mockRoute} />);
  await waitFor(() => expect(screen.getByText("Finca El Roble")).toBeTruthy());

  await fireEvent.press(screen.getByText("Finca El Roble"));
  expect(navigate).toHaveBeenCalledWith("AgroIncidents", { farmId: "farm1", farmName: "Finca El Roble" });
});

it("navigates to the tasks screen from the header button", async () => {
  (fetchAgroMemberships as jest.Mock).mockResolvedValue([]);
  await render(<AgroFarmsScreen navigation={mockNavigation} route={mockRoute} />);
  await waitFor(() => expect(screen.getByText("Mis tareas")).toBeTruthy());

  await fireEvent.press(screen.getByText("Mis tareas"));
  expect(navigate).toHaveBeenCalledWith("AgroTasks");
});
