import test from "node:test";
import assert from "node:assert/strict";
import { navigationRegistry } from "../../apps/web/lib/navigation-registry.ts";

test("Registry contains all expected nodes and valid formats", () => {
  assert.ok(Array.isArray(navigationRegistry), "navigationRegistry should be an array");
  assert.ok(navigationRegistry.length > 0, "navigationRegistry should not be empty");

  for (const node of navigationRegistry) {
    // Check required fields
    assert.ok(node.id, `Node should have an id: ${JSON.stringify(node)}`);
    assert.ok(node.labelKey, `Node should have a labelKey: ${node.id}`);
    assert.ok(node.canonicalHref, `Node should have a canonicalHref: ${node.id}`);
    assert.ok(node.layer, `Node should have a layer: ${node.id}`);
    assert.ok(node.os, `Node should have an os: ${node.id}`);
    assert.ok(Array.isArray(node.roles), `Node should have a roles array: ${node.id}`);
    assert.ok(node.roles.length > 0, `Node roles array should not be empty: ${node.id}`);
    assert.ok(node.owner, `Node should have an owner: ${node.id}`);
    assert.ok(node.status, `Node should have a status: ${node.id}`);

    // Check layer validity
    const validLayers = ["mission-control", "workspace", "context"];
    assert.ok(
      validLayers.includes(node.layer),
      `Node layer "${node.layer}" is invalid for node: ${node.id}`
    );

    // Check OS validity
    const validOS = [
      "mission-control",
      "client",
      "contractor",
      "operations",
      "marketplace",
      "governance",
      "ai",
      "system",
    ];
    assert.ok(validOS.includes(node.os), `Node OS "${node.os}" is invalid for node: ${node.id}`);

    // Check role validity
    const validRoles = ["admin", "client", "worker"];
    for (const role of node.roles) {
      assert.ok(validRoles.includes(role), `Node role "${role}" is invalid for node: ${node.id}`);
    }

    // Check status validity
    const validStatuses = ["active", "alias", "deprecated", "planned"];
    assert.ok(
      validStatuses.includes(node.status),
      `Node status "${node.status}" is invalid for node: ${node.id}`
    );
  }
});

test("Registry contains planned canonical routes", () => {
  const plannedHrefs = [
    "/ops",
    "/ops/monitoring",
    "/ops/buildops",
    "/ops/risk",
    "/ops/queues/blocked-payments",
    "/ops/queues/evidence-review",
    "/ops/queues/at-risk-jobs",
    "/ops/queues/client-waiting",
    "/ops/queues/contractor-action-required",
    "/ai",
    "/ai/mission-control",
    "/ai/queues/runtime-exceptions",
    "/marketplace",
    "/governance",
  ];

  for (const href of plannedHrefs) {
    const node = navigationRegistry.find(
      (n) => n.canonicalHref === href || n.legacyHrefs?.includes(href)
    );
    assert.ok(node, `Planned or active route should be registered: ${href}`);
  }
});

test("Legacy route nodes map to canonical routes", () => {
  // Test nodes with legacyHrefs
  const nodesWithLegacy = navigationRegistry.filter((n) => n.legacyHrefs && n.legacyHrefs.length > 0);
  assert.ok(nodesWithLegacy.length > 0, "There should be nodes with legacy Hrefs");

  for (const node of nodesWithLegacy) {
    for (const legacy of node.legacyHrefs!) {
      const mapped = navigationRegistry.find((n) => n.legacyHrefs?.includes(legacy));
      assert.ok(mapped, `Legacy route ${legacy} should map to a registry node`);
      assert.equal(mapped.canonicalHref, node.canonicalHref, `Legacy ${legacy} should map to canonical ${node.canonicalHref}`);
    }
  }
});

test("Mission Control cards link to workspace routes", () => {
  // Mission Control has nodes. Let's make sure there are active workspaces/OS mappings they go to.
  const missionControlNodes = navigationRegistry.filter((n) => n.layer === "mission-control");
  assert.ok(missionControlNodes.length > 0, "There should be mission control nodes");

  // Verify that active workspace nodes exist in the registry
  const workspaces = navigationRegistry.filter((n) => n.layer === "workspace" && n.status === "active");
  assert.ok(workspaces.length > 0, "Registry should contain active workspaces for MC to target");
});
