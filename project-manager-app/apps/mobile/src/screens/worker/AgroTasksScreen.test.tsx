import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { completeAgroTaskFromAnyStatus, fetchMyTasks } from "../../api/tasks";
import AgroTasksScreen from "./AgroTasksScreen";

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => void | (() => void)) => require("react").useEffect(effect, []),
}));
jest.mock("../../api/tasks", () => ({
  fetchMyTasks: jest.fn(),
  completeAgroTaskFromAnyStatus: jest.fn(),
  isAgroTask: (task: { id: string }) => task.id.startsWith("agrotask_"),
  toAgroFarmTaskId: (task: { id: string }) => task.id.slice("agrotask_".length),
}));

const mockNavigation = {} as unknown as Parameters<typeof AgroTasksScreen>[0]["navigation"];
const mockRoute = {} as unknown as Parameters<typeof AgroTasksScreen>[0]["route"];

const AGRO_TASK = {
  id: "agrotask_task1", tenantId: "t1", jobId: "job1", milestone: "riego", title: "Revisar riego",
  description: null, dueDate: null, priority: "medium", status: "pending",
  assignedTo: "u1", createdBy: "u1", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
};
const OTHER_TASK = { ...AGRO_TASK, id: "task2" };

beforeEach(() => {
  jest.clearAllMocks();
});

it("shows an empty state when there are no agro tasks", async () => {
  (fetchMyTasks as jest.Mock).mockResolvedValue([]);
  await render(<AgroTasksScreen navigation={mockNavigation} route={mockRoute} />);
  await waitFor(() => expect(screen.getByText("No tienes tareas Agro asignadas.")).toBeTruthy());
});

it("filters out non-agro cross-domain tasks", async () => {
  (fetchMyTasks as jest.Mock).mockResolvedValue([AGRO_TASK, OTHER_TASK]);
  await render(<AgroTasksScreen navigation={mockNavigation} route={mockRoute} />);
  await waitFor(() => expect(screen.getByText("Revisar riego")).toBeTruthy());
  expect(screen.getAllByText("Revisar riego")).toHaveLength(1);
});

it("starts then completes a pending task on press", async () => {
  (fetchMyTasks as jest.Mock).mockResolvedValue([AGRO_TASK]);
  (completeAgroTaskFromAnyStatus as jest.Mock).mockResolvedValue({ task: { id: "task1", status: "COMPLETED" } });
  await render(<AgroTasksScreen navigation={mockNavigation} route={mockRoute} />);
  await waitFor(() => expect(screen.getByText("Marcar completada")).toBeTruthy());

  await fireEvent.press(screen.getByText("Marcar completada"));
  await waitFor(() => expect(completeAgroTaskFromAnyStatus).toHaveBeenCalledWith("task1", "pending"));
});
