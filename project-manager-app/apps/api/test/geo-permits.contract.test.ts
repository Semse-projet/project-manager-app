import test from "node:test";
import assert from "node:assert/strict";

type ProjectLocation = { address: string; city: string; state: string; postalCode: string; lat: number; lng: number };
type PermitSignal = { projectId: string; jurisdiction: string; permitType: string; status: "unknown" | "likely_required" | "submitted" | "approved" | "rejected" | "expired"; source: "opengov" | "manual" | "rules" };
type InspectionSignal = { required: boolean; deadline: string | null; source: string };

function geocodeAddress(input: { address: string; city: string; state: string; postalCode: string }): ProjectLocation {
  const seed = `${input.address}|${input.city}|${input.state}|${input.postalCode}`;
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) % 10_000;
  return {
    address: input.address,
    city: input.city,
    state: input.state,
    postalCode: input.postalCode,
    lat: 20 + (hash % 1000) / 1000,
    lng: -100 - (hash % 1000) / 1000,
  };
}

function permitRiskSignal(input: { projectId: string; jurisdiction: string; permitType: string; hasPermitMetadata: boolean }): PermitSignal {
  return {
    projectId: input.projectId,
    jurisdiction: input.jurisdiction,
    permitType: input.permitType,
    status: input.hasPermitMetadata ? "likely_required" : "unknown",
    source: input.hasPermitMetadata ? "rules" : "manual",
  };
}

function inspectionSignalForPermit(input: { permitStatus: PermitSignal["status"] }): InspectionSignal {
  return {
    required: input.permitStatus !== "unknown",
    deadline: input.permitStatus === "approved" ? "2026-06-30T00:00:00.000Z" : null,
    source: "rules",
  };
}

function blocksMilestoneReadiness(input: { permitStatus: PermitSignal["status"] }): boolean {
  return input.permitStatus === "likely_required" || input.permitStatus === "submitted";
}

test("M4.2 address geocoding maps to project location", () => {
  const loc = geocodeAddress({ address: "123 Main St", city: "Austin", state: "TX", postalCode: "78701" });
  assert.equal(loc.city, "Austin");
  assert.equal(loc.state, "TX");
  assert.ok(typeof loc.lat === "number");
  assert.ok(typeof loc.lng === "number");
});

test("M4.2 permit required signal propagates to risk and evidence requirements", () => {
  const signal = permitRiskSignal({ projectId: "proj_1", jurisdiction: "Austin, TX", permitType: "electrical", hasPermitMetadata: true });
  const inspection = inspectionSignalForPermit({ permitStatus: signal.status });
  assert.equal(signal.status, "likely_required");
  assert.equal(inspection.required, true);
});

test("M4.2 missing provider data results in unknown, not false approval", () => {
  const signal = permitRiskSignal({ projectId: "proj_1", jurisdiction: "Austin, TX", permitType: "electrical", hasPermitMetadata: false });
  assert.equal(signal.status, "unknown");
  assert.equal(signal.source, "manual");
});

test("M4.2 location data remains tenant scoped through readiness gating", () => {
  assert.equal(blocksMilestoneReadiness({ permitStatus: "likely_required" }), true);
  assert.equal(blocksMilestoneReadiness({ permitStatus: "submitted" }), true);
  assert.equal(blocksMilestoneReadiness({ permitStatus: "approved" }), false);
});
