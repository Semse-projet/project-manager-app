import { evaluateLocation } from "./proximityService";
import { startTimer } from "../api/labor";
import { presentProximityNotification } from "../notifications/notifications";
import { isCoolingDown, markCooldown } from "./cooldownStore";
import { loadProximityConfig, loadProximityMode, loadSites, type ProximitySite } from "./siteCache";

jest.mock("../api/labor", () => ({ startTimer: jest.fn() }));
jest.mock("../notifications/notifications", () => ({
  presentProximityNotification: jest.fn(),
  PROXIMITY_CATEGORY: "proximity-checkin",
}));
jest.mock("./cooldownStore", () => ({ isCoolingDown: jest.fn(), markCooldown: jest.fn() }));
jest.mock("./siteCache", () => ({ loadProximityMode: jest.fn(), loadSites: jest.fn(), loadProximityConfig: jest.fn() }));

const NEARBY_JOB: ProximitySite = { kind: "job", id: "job-1", name: "Casa Pérez", latitude: 19.4326, longitude: -99.1332 };
const FAR_FREE_PROJECT: ProximitySite = { kind: "free", id: "free-1", name: "Remodelación propia", latitude: 40.7128, longitude: -74.006 };
const HERE = { latitude: 19.4326, longitude: -99.1332 }; // same point as NEARBY_JOB

beforeEach(() => {
  jest.clearAllMocks();
  (isCoolingDown as jest.Mock).mockResolvedValue(false);
  (loadProximityConfig as jest.Mock).mockResolvedValue({ radiusMeters: 150, cooldownMinutes: 20 });
});

it("does nothing for an invalid coordinate", async () => {
  await evaluateLocation({ latitude: 999, longitude: 0 });
  expect(loadProximityMode).not.toHaveBeenCalled();
});

it("does nothing when proximityCheckInMode is off", async () => {
  (loadProximityMode as jest.Mock).mockResolvedValue("off");
  await evaluateLocation(HERE);
  expect(loadSites).not.toHaveBeenCalled();
  expect(startTimer).not.toHaveBeenCalled();
  expect(presentProximityNotification).not.toHaveBeenCalled();
});

it("does nothing when no site is within range", async () => {
  (loadProximityMode as jest.Mock).mockResolvedValue("ask");
  (loadSites as jest.Mock).mockResolvedValue([FAR_FREE_PROJECT]);
  await evaluateLocation(HERE);
  expect(startTimer).not.toHaveBeenCalled();
  expect(presentProximityNotification).not.toHaveBeenCalled();
});

it("does nothing when the matching site is cooling down", async () => {
  (loadProximityMode as jest.Mock).mockResolvedValue("ask");
  (loadSites as jest.Mock).mockResolvedValue([NEARBY_JOB]);
  (isCoolingDown as jest.Mock).mockResolvedValue(true);
  await evaluateLocation(HERE);
  expect(startTimer).not.toHaveBeenCalled();
  expect(presentProximityNotification).not.toHaveBeenCalled();
});

it('mode "ask" presents a notification and never starts the timer directly', async () => {
  (loadProximityMode as jest.Mock).mockResolvedValue("ask");
  (loadSites as jest.Mock).mockResolvedValue([NEARBY_JOB]);
  await evaluateLocation(HERE);

  expect(startTimer).not.toHaveBeenCalled();
  expect(markCooldown).toHaveBeenCalledWith("job:job-1");
  expect(presentProximityNotification).toHaveBeenCalledTimes(1);
  const call = (presentProximityNotification as jest.Mock).mock.calls[0][0];
  expect(call.data).toMatchObject({ kind: "ask", siteKind: "job", siteId: "job-1" });
});

it('mode "auto" starts the timer with a proximity_auto checkIn and never blocks on distance', async () => {
  (loadProximityMode as jest.Mock).mockResolvedValue("auto");
  (loadSites as jest.Mock).mockResolvedValue([NEARBY_JOB]);
  await evaluateLocation(HERE);

  expect(startTimer).toHaveBeenCalledTimes(1);
  const call = (startTimer as jest.Mock).mock.calls[0][0];
  expect(call.purpose).toBe("job_linked");
  expect(call.jobId).toBe("job-1");
  expect(call.checkIn).toMatchObject({ latitude: HERE.latitude, longitude: HERE.longitude, method: "proximity_auto" });
  expect(presentProximityNotification).toHaveBeenCalledTimes(1);
});

it("a failing startTimer call does not throw out of evaluateLocation", async () => {
  (loadProximityMode as jest.Mock).mockResolvedValue("auto");
  (loadSites as jest.Mock).mockResolvedValue([NEARBY_JOB]);
  (startTimer as jest.Mock).mockRejectedValue(new Error("network down"));

  await expect(evaluateLocation(HERE)).resolves.toBeUndefined();
});
