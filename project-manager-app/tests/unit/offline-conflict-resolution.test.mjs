import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const timerScreenUrl = new URL(
  "../../apps/mobile/src/screens/TimerScreen.tsx",
  import.meta.url,
);

// Golden regression: offline-conflict-resolution — "Offline-queued writes
// that conflict with server state on reconnect must be surfaced, not
// silently overwritten." Expected result: "Conflict surfaced to the actor,
// not auto-resolved."
//
// KNOWN FAILING — tracked deliberately, not fixed here (out of scope for
// this batch; needs its own UX decision about what "surfaced" should look
// like on this screen, not a drive-by).
//
// Reality as of this writing: TimerScreen.tsx's load() compares
// `localTimer.id` against the remote active timer's id (`sameSession`).
// When a local timer and a remote timer exist but represent *different*
// sessions — a genuine conflict, not mere lack of connectivity — the code
// silently prefers the local timer (`nextTimer = localTimer`) and sets the
// same `offlineMode` flag used for plain "no connectivity at all", rendered
// with the same banner text ("Modo local activo: el reloj funciona sin
// conexión") either way. The actor is never told two different sessions
// existed and one was discarded; the conflict is auto-resolved, not
// surfaced. See SEMSE_EXECUTION_LEDGER.md Blockers.
//
// This is `test.todo`, not a passing assertion: per "no fake production
// claims" / "unknown is not safe", this suite must not claim the golden
// scenario holds when it doesn't. Flip this to a normal `test()` (and to
// GoldenRegressionStatus.PASSING) once a real conflict is surfaced to the
// actor (e.g. a distinct banner/state/dialog naming the discarded session),
// not just folded into the generic offline flag.
test.todo(
  "an offline-queued timer session conflicting with the server's active session is surfaced to the actor, not silently auto-resolved",
  async () => {
    const source = await readFile(timerScreenUrl, "utf8");

    assert.match(
      source,
      /sameSession/,
      "expected TimerScreen to still compare local vs remote session identity — update this test if that logic moved",
    );

    // The conflict case (`localTimer` and `usableRemote` both exist, but
    // `!sameSession`) must produce a distinct signal from the plain
    // no-connectivity case, not reuse `offlineMode`/the same banner text.
    assert.doesNotMatch(
      source,
      /setOfflineMode\(Boolean\(timer && !remoteIsUsable\) \|\| Boolean\(localTimer && usableRemote && !sameSession\)\)/,
      "TimerScreen must surface a genuine local/remote session conflict distinctly from plain offline mode " +
        "(e.g. a separate `conflictDetected` state and banner naming the discarded session), instead of folding " +
        "both cases into the same offlineMode flag and generic 'modo local activo' banner",
    );
  },
);
