import { evaluateLocation } from "./proximityService";

type LocationSample = { coords: { latitude: number; longitude: number } };
type TaskBody = { data?: { locations: LocationSample[] }; error?: { message: string } | null };

// backgroundLocationTask.ts registers its handler via TaskManager.defineTask()
// as a MODULE-LOAD side effect (it must, so the OS can wake the headless task
// context and find it already registered — see the comment in that file).
// That makes the callback itself untestable through a normal exported
// function, so instead of spying on the real expo-task-manager module we
// replace it outright and capture whatever callback backgroundLocationTask.ts
// hands to defineTask() when it's imported below.
let registeredTaskName: string | undefined;
let registeredCallback: ((body: TaskBody) => Promise<void>) | undefined;

jest.mock("expo-task-manager", () => ({
  defineTask: jest.fn((name: string, callback: (body: TaskBody) => Promise<void>) => {
    registeredTaskName = name;
    registeredCallback = callback;
  }),
}));

jest.mock("./proximityService", () => ({ evaluateLocation: jest.fn() }));

import { PROXIMITY_LOCATION_TASK } from "./backgroundLocationTask";

// registeredTaskName/registeredCallback are captured once, at module-import
// time (defineTask() is a module-load side effect, not called again per
// test) — assert against those plain variables rather than the jest.fn()'s
// call history, since a beforeEach(jest.clearAllMocks) would wipe a call
// that already happened before the first test even runs.
it("registers the task under PROXIMITY_LOCATION_TASK at module load time", () => {
  expect(PROXIMITY_LOCATION_TASK).toBe("semse-proximity-location-task");
  expect(registeredTaskName).toBe(PROXIMITY_LOCATION_TASK);
  expect(registeredCallback).toBeInstanceOf(Function);
});

beforeEach(() => {
  (evaluateLocation as jest.Mock).mockClear();
});

it("calls evaluateLocation with only the most recent location", async () => {
  const locations: LocationSample[] = [
    { coords: { latitude: 1, longitude: 2 } },
    { coords: { latitude: 19.4326, longitude: -99.1332 } },
  ];

  await registeredCallback!({ data: { locations }, error: null });

  expect(evaluateLocation).toHaveBeenCalledTimes(1);
  expect(evaluateLocation).toHaveBeenCalledWith({ latitude: 19.4326, longitude: -99.1332 });
});

it("does nothing when the task reports an error", async () => {
  await registeredCallback!({ error: { message: "gps failure" } });
  expect(evaluateLocation).not.toHaveBeenCalled();
});

it("does nothing when there are no locations", async () => {
  await registeredCallback!({ data: { locations: [] }, error: null });
  expect(evaluateLocation).not.toHaveBeenCalled();

  await registeredCallback!({ data: undefined, error: null });
  expect(evaluateLocation).not.toHaveBeenCalled();
});
