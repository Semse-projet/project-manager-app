import { evaluateLocation } from "./proximityService";
import { startTimer } from "../api/labor";
import { reportGeofenceArrival } from "../api/geofence";
import { presentProximityNotification } from "../notifications/notifications";
import { isCoolingDown, markCooldown } from "./cooldownStore";
import { loadProximityConfig, loadProximityMode, loadSites, type ProximitySite } from "./siteCache";

jest.mock("../api/labor", () => ({ startTimer: jest.fn() }));
jest.mock("../api/geofence", () => ({ reportGeofenceArrival: jest.fn() }));
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

// ---- OPEN-18 (W-07): linked worksites are decided by the server ----
const BOUND_JOB: ProximitySite = { ...NEARBY_JOB, bound: true, radiusMeters: 80 };

it("bound site + AUTO_START_ALLOWED starts proximity_auto with the server decision id", async () => {
  (loadProximityMode as jest.Mock).mockResolvedValue("auto");
  (loadSites as jest.Mock).mockResolvedValue([BOUND_JOB]);
  (reportGeofenceArrival as jest.Mock).mockResolvedValue({ id: "ge-1", eventId: "x", decision: "AUTO_START_ALLOWED", reason: "" });
  await evaluateLocation({ ...HERE, accuracy: 12 });

  const report = (reportGeofenceArrival as jest.Mock).mock.calls[0][0];
  expect(report.site).toEqual({ kind: "JOB", id: "job-1" });
  expect(report.accuracyMeters).toBe(12);
  expect(JSON.stringify(report)).not.toMatch(/latitude|longitude/);
  const call = (startTimer as jest.Mock).mock.calls[0][0];
  expect(call.geofenceEventId).toBe("ge-1");
  expect(call.checkIn.method).toBe("proximity_auto");
});

it("bound site in AUTO mode but server says PROMPT: asks, never auto-starts", async () => {
  (loadProximityMode as jest.Mock).mockResolvedValue("auto");
  (loadSites as jest.Mock).mockResolvedValue([BOUND_JOB]);
  (reportGeofenceArrival as jest.Mock).mockResolvedValue({ id: "ge-2", eventId: "x", decision: "PROMPT", reason: "" });
  await evaluateLocation(HERE);
  expect(startTimer).not.toHaveBeenCalled();
  expect((presentProximityNotification as jest.Mock).mock.calls[0][0].data).toMatchObject({ kind: "ask", siteId: "job-1" });
});

it("bound site + IGNORE: does nothing at all", async () => {
  (loadProximityMode as jest.Mock).mockResolvedValue("auto");
  (loadSites as jest.Mock).mockResolvedValue([BOUND_JOB]);
  (reportGeofenceArrival as jest.Mock).mockResolvedValue({ id: "ge-3", eventId: "x", decision: "IGNORE", reason: "" });
  await evaluateLocation(HERE);
  expect(startTimer).not.toHaveBeenCalled();
  expect(presentProximityNotification).not.toHaveBeenCalled();
});

it("bound site and the server call fails: never auto-starts, offers confirmation instead", async () => {
  (loadProximityMode as jest.Mock).mockResolvedValue("auto");
  (loadSites as jest.Mock).mockResolvedValue([BOUND_JOB]);
  (reportGeofenceArrival as jest.Mock).mockRejectedValue(new Error("offline"));
  await evaluateLocation(HERE);
  expect(startTimer).not.toHaveBeenCalled();
  expect(presentProximityNotification).toHaveBeenCalledTimes(1);
});

it("bound site uses the worksite radius, not the org radius", async () => {
  (loadProximityMode as jest.Mock).mockResolvedValue("ask");
  // ~120 m north: inside the org's 150 m radius but outside the worksite's 80 m.
  (loadSites as jest.Mock).mockResolvedValue([{ ...BOUND_JOB, latitude: HERE.latitude + 0.00108 }]);
  await evaluateLocation(HERE);
  expect(reportGeofenceArrival).not.toHaveBeenCalled();
  expect(presentProximityNotification).not.toHaveBeenCalled();
});


it("bound site + IGNORE does not start the prompt cooldown (only the short evaluation limit)", async () => {
  (loadProximityMode as jest.Mock).mockResolvedValue("ask");
  (loadSites as jest.Mock).mockResolvedValue([BOUND_JOB]);
  (reportGeofenceArrival as jest.Mock).mockResolvedValue({ id: "ev-0", decision: "IGNORE" });
  await evaluateLocation(HERE);
  expect(markCooldown).toHaveBeenCalledWith("eval:job:job-1");
  expect(markCooldown).not.toHaveBeenCalledWith("job:job-1");
  expect(presentProximityNotification).not.toHaveBeenCalled();
});

it("bound site: a visible prompt does start the prompt cooldown", async () => {
  (loadProximityMode as jest.Mock).mockResolvedValue("ask");
  (loadSites as jest.Mock).mockResolvedValue([BOUND_JOB]);
  (reportGeofenceArrival as jest.Mock).mockResolvedValue({ id: "ev-1", decision: "PROMPT" });
  await evaluateLocation(HERE);
  expect(markCooldown).toHaveBeenCalledWith("job:job-1");
  expect(presentProximityNotification).toHaveBeenCalledWith(expect.objectContaining({ title: "¿Iniciar el reloj?" }));
});

it("bound site: within the evaluation limit the arrival is not reported again", async () => {
  (loadProximityMode as jest.Mock).mockResolvedValue("ask");
  (loadSites as jest.Mock).mockResolvedValue([BOUND_JOB]);
  (isCoolingDown as jest.Mock).mockImplementation(async (key: string) => key.startsWith("eval:"));
  await evaluateLocation(HERE);
  expect(reportGeofenceArrival).not.toHaveBeenCalled();
});

it("AC-08: AUTO_START_ALLOWED but the start is rejected (409) → asks for confirmation, never retries as automatic", async () => {
  (loadProximityMode as jest.Mock).mockResolvedValue("auto");
  (loadSites as jest.Mock).mockResolvedValue([BOUND_JOB]);
  (reportGeofenceArrival as jest.Mock).mockResolvedValue({ id: "ev-2", decision: "AUTO_START_ALLOWED" });
  (startTimer as jest.Mock).mockRejectedValue(Object.assign(new Error("auto_start_not_authorized"), { status: 409 }));
  await evaluateLocation(HERE);
  expect(startTimer).toHaveBeenCalledTimes(1);
  expect(presentProximityNotification).toHaveBeenCalledTimes(1);
  expect(presentProximityNotification).toHaveBeenCalledWith(expect.objectContaining({
    title: "¿Iniciar el reloj?",
    data: expect.objectContaining({ kind: "ask", siteId: "job-1" }),
  }));
});

it("overlapping linked sites: one that just answered IGNORE does not hide the next eligible site", async () => {
  const SECOND: ProximitySite = { ...BOUND_JOB, id: "job-2", name: "Obra contigua" };
  (loadProximityMode as jest.Mock).mockResolvedValue("ask");
  (loadSites as jest.Mock).mockResolvedValue([BOUND_JOB, SECOND]);
  // job-1 is inside its evaluation limit (it answered IGNORE a moment ago); job-2 is not.
  (isCoolingDown as jest.Mock).mockImplementation(async (key: string) => key === "eval:job:job-1");
  (reportGeofenceArrival as jest.Mock).mockResolvedValue({ id: "ev-3", decision: "PROMPT" });
  await evaluateLocation(HERE);
  expect(reportGeofenceArrival).toHaveBeenCalledWith(expect.objectContaining({ site: { kind: "JOB", id: "job-2" } }));
  expect(presentProximityNotification).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ siteId: "job-2" }) }));
});
