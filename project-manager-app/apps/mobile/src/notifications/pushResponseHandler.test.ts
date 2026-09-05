import * as Notifications from "expo-notifications";
import { navigationRef } from "../navigation/navigationRef";
import { registerWorkerPushResponseListener } from "./pushResponseHandler";

jest.mock("expo-notifications", () => ({
  addNotificationResponseReceivedListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
}));
jest.mock("../navigation/navigationRef", () => ({
  navigationRef: { navigate: jest.fn(), isReady: jest.fn().mockReturnValue(true) },
}));

function fireResponse(data: Record<string, unknown> | undefined) {
  const addListener = Notifications.addNotificationResponseReceivedListener as jest.Mock;
  const handler = addListener.mock.calls[0][0] as (response: unknown) => void;
  handler({ notification: { request: { content: { data } } } });
}

beforeEach(() => {
  jest.clearAllMocks();
  (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockReturnValue({ remove: jest.fn() });
  (navigationRef.isReady as jest.Mock).mockReturnValue(true);
});

it("navigates to JobDetail for a bid_accepted push", () => {
  registerWorkerPushResponseListener();
  fireResponse({ type: "bid_accepted", jobId: "job1", bidId: "bid1" });
  expect(navigationRef.navigate).toHaveBeenCalledWith("Jobs", { screen: "JobDetail", params: { jobId: "job1" } });
});

it("navigates to DisputeDetail for a dispute_resolved push", () => {
  registerWorkerPushResponseListener();
  fireResponse({ type: "dispute_resolved", disputeId: "d1" });
  expect(navigationRef.navigate).toHaveBeenCalledWith("More", { screen: "DisputeDetail", params: { disputeId: "d1" } });
});

it("navigates to Payments (no params) for a payment_released push", () => {
  registerWorkerPushResponseListener();
  fireResponse({ type: "payment_released" });
  expect(navigationRef.navigate).toHaveBeenCalledWith("More", { screen: "Payments" });
});

it("does not navigate for an unmapped or proximity notification", () => {
  registerWorkerPushResponseListener();
  fireResponse({ kind: "ask", siteKind: "job", siteId: "job1" });
  expect(navigationRef.navigate).not.toHaveBeenCalled();
});

it("does not navigate when the navigation container isn't ready yet", () => {
  (navigationRef.isReady as jest.Mock).mockReturnValue(false);
  registerWorkerPushResponseListener();
  fireResponse({ type: "bid_accepted", jobId: "job1" });
  expect(navigationRef.navigate).not.toHaveBeenCalled();
});

it("unsubscribes on cleanup", () => {
  const remove = jest.fn();
  (Notifications.addNotificationResponseReceivedListener as jest.Mock).mockReturnValue({ remove });
  const unregister = registerWorkerPushResponseListener();
  unregister();
  expect(remove).toHaveBeenCalled();
});
