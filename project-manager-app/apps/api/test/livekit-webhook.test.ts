import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { LiveKitService } from "../dist/modules/live-sessions/livekit.service.js";
import { LiveKitWebhookController } from "../dist/modules/live-sessions/livekit-webhook.controller.js";
import type { LiveSessionsService } from "../dist/modules/live-sessions/live-sessions.service.js";

const API_KEY = "test-api-key";
const API_SECRET = "test-api-secret";

function restoreEnvVar(key: string, prev: string | undefined): void {
  // `process.env.KEY = undefined` stringifies to the literal "undefined" in
  // Node instead of removing the key — must `delete` when there was no prior
  // value, or the next test's "unconfigured" case silently becomes configured.
  if (prev === undefined) delete process.env[key];
  else process.env[key] = prev;
}

function withEnv<T>(fn: () => T): T {
  const prevUrl = process.env.LIVEKIT_URL;
  const prevKey = process.env.LIVEKIT_API_KEY;
  const prevSecret = process.env.LIVEKIT_API_SECRET;
  process.env.LIVEKIT_URL = "wss://livekit.example.com";
  process.env.LIVEKIT_API_KEY = API_KEY;
  process.env.LIVEKIT_API_SECRET = API_SECRET;
  try {
    return fn();
  } finally {
    restoreEnvVar("LIVEKIT_URL", prevUrl);
    restoreEnvVar("LIVEKIT_API_KEY", prevKey);
    restoreEnvVar("LIVEKIT_API_SECRET", prevSecret);
  }
}

/** Builds a LiveKit-webhook-style `Authorization` JWT the way a real LiveKit
 * server does: HS256, `sha256` claim = base64(sha256(exact raw body bytes)). */
function signLiveKitWebhook(rawBody: Buffer, apiKey: string, apiSecret: string): string {
  const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({
    iss: apiKey,
    exp: Math.floor(Date.now() / 1000) + 60,
    sha256: crypto.createHash("sha256").update(rawBody).digest("base64"),
  });
  const data = `${header}.${payload}`;
  const sig = crypto.createHmac("sha256", apiSecret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

// A realistic LiveKit webhook body: pretty-printed with 2-space indentation,
// the way LiveKit's Go JSON marshaller (and many non-Node HTTP clients) emit
// bytes on the wire — NOT Node's compact JSON.stringify(obj) output. This is
// exactly what makes JSON.stringify(parsedBody) (parse the body, then
// re-serialize it) an unsound stand-in for the original raw bytes: it
// collapses the whitespace and produces a different byte sequence than what
// was actually signed.
const REALISTIC_PAYLOAD = {
  room: { name: "live-session:tenant_1:ls_abc123", sid: "RM_xyz", numParticipants: 2 },
  participant: { identity: "usr_1", sid: "PA_1" },
  event: "room_started",
  createdAt: "2026-09-17T12:00:00.000Z",
  id: "EV_1",
};
const REALISTIC_BODY = Buffer.from(JSON.stringify(REALISTIC_PAYLOAD, null, 2));

// T: verifyWebhook must validate against the exact raw bytes LiveKit signed
// — not a JSON.stringify(JSON.parse(raw)) reconstruction, which silently
// breaks against any real, nested LiveKit payload (regression for the bug
// fixed in livekit-webhook.controller.ts: it used to hash
// JSON.stringify(body) after Nest/Fastify had already parsed the body).
test("verifyWebhook accepts a signature computed over the real raw body bytes", () => {
  withEnv(() => {
    const service = new LiveKitService();
    const auth = signLiveKitWebhook(REALISTIC_BODY, API_KEY, API_SECRET);
    assert.equal(service.verifyWebhook(auth, REALISTIC_BODY), true);
  });
});

test("verifyWebhook rejects a signature checked against a re-serialized (not raw) body", () => {
  withEnv(() => {
    const service = new LiveKitService();
    const auth = signLiveKitWebhook(REALISTIC_BODY, API_KEY, API_SECRET);
    // This is exactly the old, buggy call shape: JSON.stringify(JSON.parse(raw))
    // instead of the original bytes. It must NOT verify — proving the fixed
    // controller (which now passes the untouched @RawBody() buffer) is the
    // only shape that can pass.
    const reserialized = Buffer.from(JSON.stringify(JSON.parse(REALISTIC_BODY.toString("utf8"))));
    assert.notDeepEqual(reserialized, REALISTIC_BODY, "test fixture must actually exercise a byte difference");
    assert.equal(service.verifyWebhook(auth, reserialized), false);
  });
});

test("verifyWebhook rejects a tampered body", () => {
  withEnv(() => {
    const service = new LiveKitService();
    const auth = signLiveKitWebhook(REALISTIC_BODY, API_KEY, API_SECRET);
    const tampered = Buffer.from(REALISTIC_BODY.toString("utf8").replace("room_started", "room_finished"));
    assert.equal(service.verifyWebhook(auth, tampered), false);
  });
});

// T: a malformed/truncated Authorization header (a real possibility on a
// @Public() internet-facing endpoint) must be rejected cleanly, never crash
// the request — crypto.timingSafeEqual throws RangeError on a length
// mismatch instead of returning false, so the service must guard the length
// itself before calling it.
test("verifyWebhook rejects a malformed short signature instead of throwing", () => {
  withEnv(() => {
    const service = new LiveKitService();
    assert.doesNotThrow(() => service.verifyWebhook("a.b.c", REALISTIC_BODY));
    assert.equal(service.verifyWebhook("a.b.c", REALISTIC_BODY), false);
  });
});

test("verifyWebhook rejects when LiveKit is not configured", () => {
  const service = new LiveKitService(); // no env vars set in this scope
  assert.equal(service.verifyWebhook("a.b.c", REALISTIC_BODY), false);
});

// ── controller-level: signature gate + FSM dispatch ─────────────────────────

function makeFakeSessions() {
  const calls: Array<{ tenantId: string; sessionId: string; toStatus: string; correlationId: string }> = [];
  const fake = {
    async driveFromWebhook(tenantId: string, sessionId: string, toStatus: string, correlationId: string) {
      calls.push({ tenantId, sessionId, toStatus, correlationId });
    },
  } as unknown as LiveSessionsService;
  return { fake, calls };
}

test("controller rejects a webhook with no raw body at all", async () => {
  await withEnv(async () => {
    const livekit = new LiveKitService();
    const { fake } = makeFakeSessions();
    const controller = new LiveKitWebhookController(livekit, fake);
    await assert.rejects(() => controller.handle("a.b.c", {}, undefined));
  });
});

test("controller rejects an invalid signature and never drives a transition", async () => {
  await withEnv(async () => {
    const livekit = new LiveKitService();
    const { fake, calls } = makeFakeSessions();
    const controller = new LiveKitWebhookController(livekit, fake);
    const body = JSON.parse(REALISTIC_BODY.toString("utf8"));
    await assert.rejects(() => controller.handle("not-a-valid-jwt", body, REALISTIC_BODY));
    assert.equal(calls.length, 0);
  });
});

test("controller drives room_started -> ACTIVE for a well-formed, signed webhook", async () => {
  await withEnv(async () => {
    const livekit = new LiveKitService();
    const { fake, calls } = makeFakeSessions();
    const controller = new LiveKitWebhookController(livekit, fake);
    const auth = signLiveKitWebhook(REALISTIC_BODY, API_KEY, API_SECRET);
    const body = JSON.parse(REALISTIC_BODY.toString("utf8"));
    const result = await controller.handle(auth, body, REALISTIC_BODY);
    assert.deepEqual(result, { received: true });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].tenantId, "tenant_1");
    assert.equal(calls[0].sessionId, "ls_abc123");
    assert.equal(calls[0].toStatus, "ACTIVE");
  });
});

test("controller drives room_finished -> ENDED", async () => {
  await withEnv(async () => {
    const livekit = new LiveKitService();
    const { fake, calls } = makeFakeSessions();
    const controller = new LiveKitWebhookController(livekit, fake);
    const finishedBody = Buffer.from(
      JSON.stringify({
        room: { name: "live-session:tenant_1:ls_abc123", sid: "RM_xyz" },
        event: "room_finished",
        id: "EV_2",
      }),
    );
    const auth = signLiveKitWebhook(finishedBody, API_KEY, API_SECRET);
    const result = await controller.handle(auth, JSON.parse(finishedBody.toString("utf8")), finishedBody);
    assert.deepEqual(result, { received: true });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].toStatus, "ENDED");
  });
});

test("controller rejects an unrecognized room name even with a valid signature", async () => {
  await withEnv(async () => {
    const livekit = new LiveKitService();
    const { fake, calls } = makeFakeSessions();
    const controller = new LiveKitWebhookController(livekit, fake);
    const badRoomBody = Buffer.from(JSON.stringify({ room: { name: "not-a-live-session-room" }, event: "room_started" }));
    const auth = signLiveKitWebhook(badRoomBody, API_KEY, API_SECRET);
    await assert.rejects(() => controller.handle(auth, JSON.parse(badRoomBody.toString("utf8")), badRoomBody));
    assert.equal(calls.length, 0);
  });
});
