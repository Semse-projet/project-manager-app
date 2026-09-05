import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  capabilityDefinitionManifestSchema,
  capabilityExecutionGrantSchema,
  capabilityInstallationSchema,
  capabilityOperationApprovalSchema,
} from "../../packages/schemas/src/capability-control-plane.schema.ts";
import {
  IncompatibleDependencyError,
  createDeploymentPlan,
  deploymentPlanDigest,
} from "../../packages/control-plane/dist/planner.js";
import {
  ManifestTrustError,
  parseCapabilityManifest,
} from "../../packages/control-plane/dist/manifest.js";
import type { CapabilityDefinitionManifest } from "../../packages/control-plane/src/types.ts";

const fixtureUrl = (name: string) =>
  new URL(`../fixtures/capabilities/${name}`, import.meta.url);

const trustPolicy = {
  trustedPublishers: ["semse-core"],
  trustedSignatureDigests: [
    "sha256:1111111111111111111111111111111111111111111111111111111111111111",
  ],
  requireAttestation: true,
} as const;

async function loadFixture(name: string): Promise<unknown> {
  return JSON.parse(await readFile(fixtureUrl(name), "utf8"));
}

function dependencyManifest(
  source: CapabilityDefinitionManifest,
  name: string,
  version: string,
): CapabilityDefinitionManifest {
  return {
    ...source,
    metadata: { ...source.metadata, name, version },
    spec: {
      ...source.spec,
      dependencies: { required: [], optional: [] },
      runtime: {
        ...source.spec.runtime,
        image: `${name}/runtime@sha256:${"e".repeat(64)}`,
      },
    },
  };
}

test("T-010/T-020: accepts the canonical fixture and rejects invalid or malicious manifests", async () => {
  const valid = capabilityDefinitionManifestSchema.safeParse(
    await loadFixture("valid-local-ai-runtime.json"),
  );
  assert.equal(valid.success, true);

  for (const name of [
    "invalid-secret-literal.json",
    "invalid-mutable-tag.json",
    "malicious-command.json",
  ]) {
    const parsed = capabilityDefinitionManifestSchema.safeParse(
      await loadFixture(name),
    );
    assert.equal(parsed.success, false, `${name} must be rejected`);
  }
});

test("T-010/T-031: publisher and attestation trust are explicit and fail closed", async () => {
  const valid = capabilityDefinitionManifestSchema.parse(
    await loadFixture("valid-local-ai-runtime.json"),
  );
  assert.equal(parseCapabilityManifest(valid, trustPolicy).metadata.publisher, "semse-core");

  const untrusted = {
    ...valid,
    metadata: {
      ...valid.metadata,
      publisher: "unknown-publisher",
      attestation: {
        ...valid.metadata.attestation!,
        signer: "unknown-publisher",
      },
    },
  };
  assert.throws(
    () => parseCapabilityManifest(untrusted, trustPolicy),
    ManifestTrustError,
  );
});

test("T-020/T-022/T-023: lifecycle, approval and grant schemas fail closed", () => {
  const invalidInstallation = capabilityInstallationSchema.safeParse({
    id: "installation-a",
    tenantId: "tenant-a",
    orgId: "org-a",
    workspaceId: "workspace-a",
    capabilityName: "local-ai-runtime",
    desiredVersion: "^1.0.0",
    resolvedVersion: "1.0.0",
    desiredState: "DEGRADED",
    observedState: "ACTIVE",
    runtimeTargetId: "local-dev",
    configurationRevision: 1,
    lastOperationId: null,
    observedAt: null,
  });
  assert.equal(invalidInstallation.success, false);

  const approvalWithCommand = capabilityOperationApprovalSchema.safeParse({
    id: "approval-a",
    operationId: "operation-a",
    approvalMode: "single",
    status: "APPROVED",
    planDigest: `sha256:${"a".repeat(64)}`,
    configurationRevision: 1,
    runtimeTargetId: "local-dev",
    requestedByActorId: "requester-a",
    decidedByActorId: "approver-a",
    decidedByActorType: "user",
    decidedByRoles: ["OPS_ADMIN"],
    expiresAt: "2026-07-19T18:10:00.000Z",
    decidedAt: "2026-07-19T18:00:00.000Z",
    command: "docker compose up",
  });
  assert.equal(approvalWithCommand.success, false);

  const overlongGrant = capabilityExecutionGrantSchema.safeParse({
    grantHandle: "grant://local/operation-a",
    operationId: "operation-a",
    planDigest: `sha256:${"a".repeat(64)}`,
    configurationRevision: 1,
    runtimeTargetId: "local-dev",
    audience: "capability-executor",
    purpose: "compose.observe",
    nonce: "0123456789abcdef",
    issuedAt: "2026-07-19T18:00:00.000Z",
    expiresAt: "2026-07-19T18:02:00.001Z",
  });
  assert.equal(overlongGrant.success, false);
});

test("T-012: creates the same canonical plan and digest for equivalent input", async () => {
  const manifest = capabilityDefinitionManifestSchema.parse(
    await loadFixture("valid-local-ai-runtime.json"),
  ) as CapabilityDefinitionManifest;
  const availableManifests = [
    dependencyManifest(manifest, "identity", "1.4.0"),
    dependencyManifest(manifest, "events", "1.2.1"),
    dependencyManifest(manifest, "governance", "1.1.0"),
  ];
  const input = {
    operationId: "op-001",
    manifest,
    availableManifests,
    trustPolicy,
    target: { adapter: "compose" as const, targetId: "local-dev" },
    configurationRevision: 3,
    intent: "ACTIVATE" as const,
    rollbackTargetRevision: "revision-2",
  };

  const first = createDeploymentPlan(input);
  const second = createDeploymentPlan({
    ...input,
    availableManifests: [...availableManifests].reverse(),
  });

  assert.deepEqual(first, second);
  assert.equal(deploymentPlanDigest(first), deploymentPlanDigest(second));
  assert.deepEqual(
    first.resolvedDependencies.map(({ name, version }) => ({ name, version })),
    [
      { name: "events", version: "1.2.1" },
      { name: "governance", version: "1.1.0" },
      { name: "identity", version: "1.4.0" },
    ],
  );
});

test("T-012/CP-004: target, configuration revision and capability version change the digest", async () => {
  const manifest = capabilityDefinitionManifestSchema.parse(
    await loadFixture("valid-local-ai-runtime.json"),
  ) as CapabilityDefinitionManifest;
  const availableManifests = [
    dependencyManifest(manifest, "identity", "1.0.0"),
    dependencyManifest(manifest, "events", "1.0.0"),
  ];
  const base = {
    operationId: "op-002",
    manifest,
    availableManifests,
    trustPolicy,
    target: { adapter: "compose" as const, targetId: "local-dev" },
    configurationRevision: 1,
    intent: "ACTIVATE" as const,
    rollbackTargetRevision: "revision-0",
  };
  const baseDigest = deploymentPlanDigest(createDeploymentPlan(base));
  const targetDigest = deploymentPlanDigest(
    createDeploymentPlan({
      ...base,
      target: { adapter: "compose", targetId: "local-secondary" },
    }),
  );
  const revisionDigest = deploymentPlanDigest(
    createDeploymentPlan({ ...base, configurationRevision: 2 }),
  );
  const versionDigest = deploymentPlanDigest(
    createDeploymentPlan({
      ...base,
      manifest: {
        ...manifest,
        metadata: { ...manifest.metadata, version: "1.0.1" },
      },
    }),
  );

  assert.notEqual(targetDigest, baseDigest);
  assert.notEqual(revisionDigest, baseDigest);
  assert.notEqual(versionDigest, baseDigest);
});

test("T-012/CP-007: an incompatible required dependency blocks planning", async () => {
  const manifest = capabilityDefinitionManifestSchema.parse(
    await loadFixture("incompatible-dependency.json"),
  ) as CapabilityDefinitionManifest;
  const availableManifests = [dependencyManifest(manifest, "identity", "1.9.9")];

  assert.throws(
    () =>
      createDeploymentPlan({
        operationId: "op-incompatible",
        manifest,
        availableManifests,
        trustPolicy,
        target: { adapter: "compose", targetId: "local-dev" },
        configurationRevision: 1,
        intent: "ACTIVATE",
        rollbackTargetRevision: "revision-0",
      }),
    (error: unknown) =>
      error instanceof IncompatibleDependencyError &&
      error.dependencyName === "identity",
  );
});
