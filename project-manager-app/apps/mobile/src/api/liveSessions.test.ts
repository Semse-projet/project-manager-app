import { apiFetch } from "./client";
import { askPrometeo, createLiveSession, fetchMobileNotifications, fetchMobileTasks, markMobileNotificationRead, transitionLiveSession, updateMobileTask } from "./liveSessions";

jest.mock("./client", () => ({ apiFetch: jest.fn() }));

const mockedApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

beforeEach(() => jest.clearAllMocks());

it("creates an inspection with the governed session contract", async () => {
  mockedApiFetch.mockResolvedValue({ id: "s1", scopeType: "job", scopeId: "j1", purpose: "inspection", status: "REQUESTED", version: 1 });
  await createLiveSession({ scopeType: "job", scopeId: "j1", purpose: "inspection", idempotencyKey: "mobile-j1-1" });
  expect(mockedApiFetch).toHaveBeenCalledWith("/v1/prometeo/live-sessions", expect.objectContaining({ method: "POST" }));
});

it("uses the current version when transitioning a session", async () => {
  mockedApiFetch.mockResolvedValue({ id: "s1", status: "ENDED", version: 3 });
  await transitionLiveSession("s1", { action: "end", expectedVersion: 2 });
  expect(mockedApiFetch).toHaveBeenCalledWith("/v1/prometeo/live-sessions/s1/transition", expect.objectContaining({ method: "POST" }));
});

it("keeps task and notification payloads normalized", async () => {
  mockedApiFetch.mockResolvedValueOnce([{ id: "t1", jobId: "j1", title: "Revisar", status: "pending" }]);
  mockedApiFetch.mockResolvedValueOnce({ items: [{ id: "n1", message: "Actualización" }] });
  mockedApiFetch.mockResolvedValueOnce({ id: "t1", status: "done" });
  mockedApiFetch.mockResolvedValueOnce({ id: "n1", readAt: "now" });

  expect(await fetchMobileTasks()).toHaveLength(1);
  expect(await fetchMobileNotifications()).toHaveLength(1);
  await updateMobileTask("t1", "done");
  await markMobileNotificationRead("n1");
  expect(mockedApiFetch).toHaveBeenCalledTimes(4);
});

it("sends Prometeo messages with the selected agent", async () => {
  mockedApiFetch.mockResolvedValue({ reply: "Listo", threadId: "th1" });
  await askPrometeo({ message: "Resume mi job", agentId: "prometeo" });
  expect(mockedApiFetch).toHaveBeenCalledWith("/v1/agents/chat", expect.objectContaining({ method: "POST" }));
});
