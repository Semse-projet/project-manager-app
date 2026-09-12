const mockStorage = new Map<string, string>();
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => { mockStorage.set(key, value); }),
  deleteItemAsync: jest.fn(async (key: string) => { mockStorage.delete(key); }),
}));

import { apiFetch, clearTokens, setTokens, subscribeSessionExpired } from "./client";

const response = (status: number, body: unknown) => ({
  status, ok: status >= 200 && status < 300,
  json: async () => body,
}) as Response;
const originalFetch = global.fetch;

beforeEach(async () => {
  await clearTokens();
  mockStorage.clear();
  await setTokens({ accessToken: "old", refreshToken: "refresh-old" });
});
afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); });

test("concurrent 401s rotate once and retry with the new access token", async () => {
  const fetchMock = jest.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/auth/refresh")) return response(200, { data: { accessToken: "new", refreshToken: "refresh-new" } });
    const auth = (init?.headers as Record<string, string>).authorization;
    return auth === "Bearer old" ? response(401, {}) : response(200, { data: "ok" });
  });
  global.fetch = fetchMock as typeof fetch;
  expect(await Promise.all([apiFetch("/v1/jobs"), apiFetch("/v1/tasks")])).toEqual(["ok", "ok"]);
  expect(fetchMock.mock.calls.filter(([url]) => url.endsWith("/auth/refresh"))).toHaveLength(1);
  expect(mockStorage.get("semse.refreshToken")).toBe("refresh-new");
});

test("logout during refresh cannot resurrect the previous account", async () => {
  let finish!: (value: Response) => void;
  let started!: () => void;
  const ready = new Promise<void>((resolve) => { started = resolve; });
  global.fetch = jest.fn(async (url: string) => {
    if (url.endsWith("/auth/refresh")) {
      started();
      return new Promise<Response>((resolve) => { finish = resolve; });
    }
    return response(401, {});
  }) as typeof fetch;
  const pending = apiFetch("/v1/jobs");
  const assertion = expect(pending).rejects.toMatchObject({ status: 401 });
  await ready;
  await clearTokens();
  finish(response(200, { data: { accessToken: "stale", refreshToken: "stale-refresh" } }));
  await assertion;
  expect(mockStorage.size).toBe(0);
});

test("a transient refresh failure preserves credentials", async () => {
  global.fetch = jest.fn(async (url: string) => response(url.endsWith("/auth/refresh") ? 503 : 401, {})) as typeof fetch;
  await expect(apiFetch("/v1/jobs")).rejects.toMatchObject({ status: 503 });
  expect(mockStorage.get("semse.refreshToken")).toBe("refresh-old");
});

test("rejected refresh invalidates the session and notifies the UI", async () => {
  const expired = jest.fn();
  const unsubscribe = subscribeSessionExpired(expired);
  global.fetch = jest.fn(async () => response(401, {})) as typeof fetch;
  await expect(apiFetch("/v1/jobs")).rejects.toMatchObject({ status: 401 });
  expect(mockStorage.size).toBe(0);
  expect(expired).toHaveBeenCalledTimes(1);
  unsubscribe();
});

test("uses the nested Nest error message and does not refresh forbidden requests", async () => {
  const fetchMock = jest.fn(async () => response(403, { error: { message: { message: "No tienes permiso" } } }));
  global.fetch = fetchMock as typeof fetch;
  await expect(apiFetch("/v1/jobs")).rejects.toThrow("No tienes permiso");
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test.each(["https://other.example/v1/jobs", "//other.example/v1/jobs", "/v1/../auth", "/v1/jobs#fragment"]) (
  "refuses an unsafe request path: %s", async (path) => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    await expect(apiFetch(path)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  },
);

test("empty POSTs do not send an empty application/json body to Fastify", async () => {
  const fetchMock = jest.fn<Promise<Response>, [string, RequestInit?]>(async () => response(200, { data: null }));
  global.fetch = fetchMock as typeof fetch;
  await apiFetch("/v1/labor/timer/id/pause", { method: "POST" });
  const init = fetchMock.mock.calls[0]![1] as RequestInit;
  expect((init.headers as Record<string, string>)["content-type"]).toBeUndefined();
});

test("204 responses are accepted", async () => {
  global.fetch = jest.fn(async () => response(204, undefined)) as typeof fetch;
  await expect(apiFetch("/v1/auth/logout", { method: "POST" }, false)).resolves.toBeUndefined();
});
