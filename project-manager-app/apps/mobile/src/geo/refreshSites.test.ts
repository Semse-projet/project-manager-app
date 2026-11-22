jest.mock("../api/labor", () => ({
  fetchJobs: jest.fn(async () => []),
  fetchFreeProjects: jest.fn(async () => []),
  fetchProximityConfig: jest.fn(async () => null),
}));
jest.mock("../api/profile", () => ({ fetchProfile: jest.fn() }));
jest.mock("../api/locationPreference", () => ({ readLocationPreference: jest.fn() }));
jest.mock("../api/geofence", () => ({ fetchGeofenceSites: jest.fn(async () => null) }));
jest.mock("./siteCache", () => ({
  saveSites: jest.fn(async () => undefined),
  saveProximityMode: jest.fn(async () => undefined),
  saveProximityConfig: jest.fn(async () => undefined),
}));
jest.mock("./backgroundLocation", () => ({ stopProximityTracking: jest.fn(async () => undefined) }));

import { fetchProfile } from "../api/profile";
import { readLocationPreference } from "../api/locationPreference";
import { saveProximityMode } from "./siteCache";
import { stopProximityTracking } from "./backgroundLocation";
import { refreshProximitySites } from "./refreshSites";

const profile = fetchProfile as jest.Mock;
const readPref = readLocationPreference as jest.Mock;
const saveMode = saveProximityMode as jest.Mock;
const stop = stopProximityTracking as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  profile.mockResolvedValue({ proximityCheckInMode: "auto" });
});

it("BO-09 en error (503) con perfil anterior auto: guarda off y detiene la ubicación en segundo plano", async () => {
  readPref.mockResolvedValue({ kind: "error", message: "503" });
  await refreshProximitySites();
  expect(saveMode).toHaveBeenCalledWith("off");
  expect(saveMode).not.toHaveBeenCalledWith("auto");
  expect(stop).toHaveBeenCalled();
});

it("BO-09 apagado (404): conserva el modo del perfil y no detiene nada", async () => {
  readPref.mockResolvedValue({ kind: "disabled" });
  await refreshProximitySites();
  expect(saveMode).toHaveBeenCalledWith("auto");
  expect(stop).not.toHaveBeenCalled();
});

it("BO-09 en ASK sobre un auto guardado: el modo que lee la tarea pasa a ask", async () => {
  readPref.mockResolvedValue({ kind: "ok", pref: { mode: "ASK", effectiveMode: "ASK", autoStartConsent: false, policyVersion: 1 } });
  await refreshProximitySites();
  expect(saveMode).toHaveBeenCalledWith("ask");
  expect(stop).not.toHaveBeenCalled();
});

it("BO-09 en OFF: guarda off y detiene la ubicación en segundo plano", async () => {
  readPref.mockResolvedValue({ kind: "ok", pref: { mode: "OFF", effectiveMode: "OFF", autoStartConsent: false, policyVersion: 1 } });
  await refreshProximitySites();
  expect(saveMode).toHaveBeenCalledWith("off");
  expect(stop).toHaveBeenCalled();
});
