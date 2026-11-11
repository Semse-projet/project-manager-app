import assert from "node:assert/strict";
import test from "node:test";
import { buildCrewRoomTaskTitle, MAX_CREW_ROOM_LENGTH, MAX_CREW_WORK_LENGTH } from "../../apps/web/lib/crew-room-task-title.ts";

test("room assignment preserves a clear, single canonical task title", () => {
  assert.equal(buildCrewRoomTaskTitle("Hab. 205", "Reparar pared"), "Hab. 205 — Reparar pared");
  assert.equal(buildCrewRoomTaskTitle(" Room 202 ", " Apply texture "), "Room 202 — Apply texture");
  assert.equal(buildCrewRoomTaskTitle("2.º piso\nPasillo", " Reparar   drywall \n y limpiar "), "2.º piso Pasillo — Reparar drywall y limpiar");
});

test("room and task must both be nonempty and fit JobTask 200-character contract", () => {
  assert.equal(buildCrewRoomTaskTitle("", "Pintar"), null);
  assert.equal(buildCrewRoomTaskTitle("   ", "Pintar"), null);
  assert.equal(buildCrewRoomTaskTitle("Hab. 205", ""), null);
  assert.equal(buildCrewRoomTaskTitle("Hab. 205", "x"), null);
  assert.equal(buildCrewRoomTaskTitle("x".repeat(MAX_CREW_ROOM_LENGTH + 1), "Reparar"), null);
  assert.equal(buildCrewRoomTaskTitle("Hab. 205", "x".repeat(MAX_CREW_WORK_LENGTH + 1)), null);
  const maxTitle = buildCrewRoomTaskTitle("x".repeat(MAX_CREW_ROOM_LENGTH), "y".repeat(MAX_CREW_WORK_LENGTH));
  assert.equal(maxTitle?.length, MAX_CREW_ROOM_LENGTH + 3 + MAX_CREW_WORK_LENGTH);
  assert.ok((maxTitle?.length ?? Infinity) <= 200);
});
