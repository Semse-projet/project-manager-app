import test from "node:test";
import assert from "node:assert/strict";
import {
  canApplyMissionAction,
  nextMissionLifecycle,
  resolveRightPanelMode,
  rightPanelModeForMission,
} from "../dist/modules/workspace/workspace.fsm.js";

test("canApplyMissionAction: none allows load only", () => {
  assert.equal(canApplyMissionAction("none", "load"), true);
  assert.equal(canApplyMissionAction("none", "unload"), false);
});

test("canApplyMissionAction: loaded allows load and unload", () => {
  assert.equal(canApplyMissionAction("loaded", "load"), true);
  assert.equal(canApplyMissionAction("loaded", "unload"), true);
});

test("nextMissionLifecycle transitions", () => {
  assert.equal(nextMissionLifecycle("none", "load"), "loaded");
  assert.equal(nextMissionLifecycle("loaded", "load"), "loaded");
  assert.equal(nextMissionLifecycle("loaded", "unload"), "none");
});

test("nextMissionLifecycle throws on illegal transition", () => {
  assert.throws(() => nextMissionLifecycle("none", "unload"), /Illegal workspace mission transition/);
});

test("rightPanelModeForMission always operational", () => {
  assert.equal(rightPanelModeForMission("project"), "operational");
  assert.equal(rightPanelModeForMission("budget"), "operational");
});

test("resolveRightPanelMode prefers requested, falls back", () => {
  assert.equal(resolveRightPanelMode("configuration", "operational"), "configuration");
  assert.equal(resolveRightPanelMode(undefined, "operational"), "operational");
});
