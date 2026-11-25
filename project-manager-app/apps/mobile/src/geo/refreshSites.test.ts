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

import { fetchJobs } from "../api/labor";
import { fetchGeofenceSites } from "../api/geofence";
import { fetchProfile } from "../api/profile";
import { readLocationPreference } from "../api/locationPreference";
import { saveProximityMode, saveSites } from "./siteCache";
import { stopProximityTracking } from "./backgroundLocation";
import { refreshProximitySites } from "./refreshSites";

const profile = fetchProfile as jest.Mock;
const readPref = readLocationPreference as jest.Mock;
const saveMode = saveProximityMode as jest.Mock;
const stop = stopProximityTracking as jest.Mock;
const jobs = fetchJobs as jest.Mock;
const geofenceSites = fetchGeofenceSites as jest.Mock;
const persistSites = saveSites as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  profile.mockResolvedValue({ proximityCheckInMode: "auto" });
  jobs.mockResolvedValue([]);
  geofenceSites.mockResolvedValue(null);
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

it("geofence-sites en error no guarda coordenadas locales para un auto-inicio", async () => {
  readPref.mockResolvedValue({ kind: "disabled" });
  jobs.mockResolvedValue([{ id: "job_1", title: "Obra", latitude: 40, longitude: -3 }]);
  geofenceSites.mockRejectedValue(new Error("503"));
  await refreshProximitySites();
  expect(persistSites).toHaveBeenCalledWith([]);
});

it("geofence-sites en 404 conserva los jobs locales", async () => {
  readPref.mockResolvedValue({ kind: "disabled" });
  jobs.mockResolvedValue([{ id: "job_1", title: "Obra", latitude: 40, longitude: -3 }]);
  geofenceSites.mockResolvedValue(null);
  await refreshProximitySites();
  expect(persistSites).toHaveBeenCalledWith([
    { kind: "job", id: "job_1", name: "Obra", latitude: 40, longitude: -3 },
  ]);
});

it("BO-09 en OFF: guarda off y detiene la ubicación en segundo plano", async () => {
  readPref.mockResolvedValue({ kind: "ok", pref: { mode: "OFF", effectiveMode: "OFF", autoStartConsent: false, policyVersion: 1 } });
  await refreshProximitySites();
  expect(saveMode).toHaveBeenCalledWith("off");
  expect(stop).toHaveBeenCalled();
});

it("rollback: con el flag de vínculos apagado (404), la siguiente actualización sustituye las obras vinculadas en caché por los jobs locales", async () => {
  readPref.mockResolvedValue({ kind: "ok", pref: { mode: "AUTO", effectiveMode: "AUTO", autoStartConsent: true, policyVersion: 1 } });
  // 1) Flag encendido: el servidor devuelve una obra vinculada y se guarda marcada como `bound`.
  geofenceSites.mockResolvedValueOnce([
    { kind: "JOB", targetId: "job-1", worksiteId: "w1", worksiteName: "Obra Norte", latitude: 19.43, longitude: -99.13, radiusMeters: 150, verified: true },
  ]);
  jobs.mockResolvedValue([{ id: "job-1", title: "Trabajo 1", latitude: 19.5, longitude: -99.2 }]);
  await refreshProximitySites();
  expect(persistSites).toHaveBeenLastCalledWith([expect.objectContaining({ id: "job-1", bound: true, name: "Obra Norte" })]);
  // 2) Rollback: el flag se apaga y geofence-sites responde 404 → vuelven las coordenadas del job, sin `bound`.
  geofenceSites.mockResolvedValueOnce(null);
  await refreshProximitySites();
  const last = persistSites.mock.calls.at(-1)?.[0];
  expect(last).toEqual([{ kind: "job", id: "job-1", name: "Trabajo 1", latitude: 19.5, longitude: -99.2 }]);
});
