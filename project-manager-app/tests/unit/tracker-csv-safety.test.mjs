import test from "node:test";
import assert from "node:assert/strict";
import {
  safeTrackerCsvCell,
  trackerCsvSyncState,
} from "../../apps/web/app/(app)/worker/tracker/sections/trackerCsv.ts";

test("CSV encodes untrusted formula prefixes as literal text", () => {
  const attempts = [
    "=1+1",
    "+SUM(A1:A5)",
    "-HYPERLINK(\"https://example.invalid\",\"open\")",
    "@SUM(1,2)",
    "  =1+1",
    "\t=1+1",
    "\r=1+1",
    "\n=1+1",
    "\u200b=1+1",
    "\u202e=1+1",
  ];
  for (const text of attempts) {
    assert.equal(safeTrackerCsvCell(text), `"'${text.replaceAll('"', '""')}"`);
  }
});

test("CSV quotes ordinary project names, Unicode, quotes and line breaks", () => {
  assert.equal(safeTrackerCsvCell('Piso 2, "Cocina"'), '"Piso 2, ""Cocina"""');
  assert.equal(safeTrackerCsvCell("Pintura\nRevisión"), '"Pintura\nRevisión"');
  assert.equal(safeTrackerCsvCell("Eléctrico"), '"Eléctrico"');
  assert.equal(safeTrackerCsvCell(null), '""');
});

test("CSV keeps numeric cells numeric, including negative numbers", () => {
  assert.equal(safeTrackerCsvCell(-12.5), '"-12.5"');
  assert.equal(safeTrackerCsvCell(0), '"0"');
  assert.equal(safeTrackerCsvCell("-12.5"), '"\'-12.5"');
});

test("CSV sync state does not confuse local entries with persisted hours", () => {
  assert.equal(trackerCsvSyncState("pending_sync"), "pendiente_dispositivo");
  for (const status of ["running", "paused", "completed", "pending_review", "approved", "deleted"]) {
    assert.equal(trackerCsvSyncState(status), "guardado_servidor");
  }
  for (const status of ["", "unknown", "failed_sync", "pending_replay"]) {
    assert.equal(trackerCsvSyncState(status), "origen_desconocido");
  }
});
