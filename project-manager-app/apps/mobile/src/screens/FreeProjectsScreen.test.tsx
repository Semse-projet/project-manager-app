import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { createFreeProject, fetchFreeProjectList, updateFreeProject } from "../api/labor";
import FreeProjectsScreen from "./FreeProjectsScreen";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => require("react").useEffect(effect, []),
}));
jest.mock("../api/labor", () => ({
  fetchFreeProjectList: jest.fn(),
  createFreeProject: jest.fn(),
  updateFreeProject: jest.fn(),
}));
// The map itself is a WebView running Leaflet — not worth rendering in jsdom-less
// RN tests. Stub it to a no-op so the form around it is what's under test.
jest.mock("../components/LocationPickerMap", () => ({
  LocationPickerMap: () => null,
}));

beforeEach(() => {
  jest.clearAllMocks();
});

it("shows an empty state when there are no projects", async () => {
  (fetchFreeProjectList as jest.Mock).mockResolvedValue([]);
  await render(<FreeProjectsScreen />);
  await waitFor(() => expect(screen.getByText("Aún no tienes proyectos libres.")).toBeTruthy());
});

it("lists existing projects", async () => {
  (fetchFreeProjectList as jest.Mock).mockResolvedValue([
    { id: "fp1", name: "Casa Pérez", color: "#2563eb", location: "CDMX", latitude: null, longitude: null, description: null, status: "active" },
  ]);
  await render(<FreeProjectsScreen />);
  await waitFor(() => expect(screen.getByText("Casa Pérez")).toBeTruthy());
  expect(screen.getByText("CDMX")).toBeTruthy();
});

it("creates a new project from the form", async () => {
  (fetchFreeProjectList as jest.Mock).mockResolvedValue([]);
  (createFreeProject as jest.Mock).mockResolvedValue({ id: "fp-new" });
  await render(<FreeProjectsScreen />);
  await waitFor(() => expect(screen.getByText("+ Nuevo proyecto")).toBeTruthy());

  await fireEvent.press(screen.getByText("+ Nuevo proyecto"));
  await waitFor(() => expect(screen.getByPlaceholderText("Remodelación casa Pérez...")).toBeTruthy());

  await fireEvent.changeText(screen.getByPlaceholderText("Remodelación casa Pérez..."), "Proyecto nuevo");
  await fireEvent.press(screen.getByText("Crear proyecto"));

  await waitFor(() => expect(createFreeProject).toHaveBeenCalledWith(expect.objectContaining({ name: "Proyecto nuevo" })));
});

it("pre-fills the form when editing an existing project", async () => {
  (fetchFreeProjectList as jest.Mock).mockResolvedValue([
    { id: "fp1", name: "Casa Pérez", color: "#2563eb", location: "CDMX", latitude: 19.43, longitude: -99.13, description: "Baño y cocina", status: "active" },
  ]);
  (updateFreeProject as jest.Mock).mockResolvedValue({ id: "fp1" });
  await render(<FreeProjectsScreen />);
  await waitFor(() => expect(screen.getByText("Casa Pérez")).toBeTruthy());

  await fireEvent.press(screen.getByText("Casa Pérez"));
  await waitFor(() => expect(screen.getByDisplayValue("Casa Pérez")).toBeTruthy());
  expect(screen.getByDisplayValue("CDMX")).toBeTruthy();

  await fireEvent.press(screen.getByText("Guardar cambios"));
  await waitFor(() => expect(updateFreeProject).toHaveBeenCalledWith("fp1", expect.objectContaining({ name: "Casa Pérez" })));
});
