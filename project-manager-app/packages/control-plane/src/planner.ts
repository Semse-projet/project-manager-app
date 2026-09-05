import { createHash } from "node:crypto";

import {
  compareSemver,
  parseCapabilityManifest,
  parseDependencyReference,
  satisfiesSemverRange,
} from "./manifest.js";
import type {
  CapabilityDefinitionManifest,
  CapabilityIntent,
  CapabilityRisk,
  CapabilityRuntimeAction,
  DeploymentPlan,
  DeploymentPlanStep,
  ManifestTrustPolicy,
  ResolvedCapabilityDependency,
} from "./types.js";

export interface CreateDeploymentPlanInput {
  operationId: string;
  manifest: CapabilityDefinitionManifest;
  availableManifests: CapabilityDefinitionManifest[];
  trustPolicy: ManifestTrustPolicy;
  target: DeploymentPlan["target"];
  configurationRevision: number;
  intent: CapabilityIntent;
  rollbackTargetRevision?: string;
}

export class IncompatibleDependencyError extends Error {
  readonly dependencyName: string;
  readonly requiredRange: string;

  constructor(dependencyName: string, requiredRange: string) {
    super(`no compatible version for ${dependencyName}@${requiredRange}`);
    this.name = "IncompatibleDependencyError";
    this.dependencyName = dependencyName;
    this.requiredRange = requiredRange;
  }
}

export class UnsupportedRuntimeAdapterError extends Error {
  constructor(adapter: string) {
    super(`runtime adapter is not supported by the F3 planner: ${adapter}`);
    this.name = "UnsupportedRuntimeAdapterError";
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, nested]) => nested !== undefined)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function stableSha256Digest(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
}

function resolveOne(
  dependencyReference: string,
  manifests: readonly CapabilityDefinitionManifest[],
  trustPolicy: ManifestTrustPolicy,
  required: boolean,
): ResolvedCapabilityDependency | null {
  const dependency = parseDependencyReference(dependencyReference);
  const candidates = manifests
    .map((manifest) => parseCapabilityManifest(manifest, trustPolicy))
    .filter(
      (manifest) =>
        manifest.metadata.name === dependency.name &&
        satisfiesSemverRange(manifest.metadata.version, dependency.range),
    )
    .sort((left, right) => compareSemver(right.metadata.version, left.metadata.version));

  const selected = candidates[0];
  if (!selected) {
    if (!required) return null;
    throw new IncompatibleDependencyError(dependency.name, dependency.range);
  }
  return { name: selected.metadata.name, version: selected.metadata.version };
}

export function resolveCapabilityDependencies(
  manifest: CapabilityDefinitionManifest,
  availableManifests: readonly CapabilityDefinitionManifest[],
  trustPolicy: ManifestTrustPolicy,
): ResolvedCapabilityDependency[] {
  const resolved = [
    ...manifest.spec.dependencies.required.map((reference) =>
      resolveOne(reference, availableManifests, trustPolicy, true),
    ),
    ...manifest.spec.dependencies.optional.map((reference) =>
      resolveOne(reference, availableManifests, trustPolicy, false),
    ),
  ].filter((dependency): dependency is ResolvedCapabilityDependency => dependency !== null);

  return resolved.sort((left, right) =>
    left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
  );
}

function riskFor(manifest: CapabilityDefinitionManifest): CapabilityRisk {
  switch (manifest.spec.dataClassification) {
    case "restricted":
      return "critical";
    case "confidential":
      return "high";
    case "internal":
      return "medium";
    default:
      return "low";
  }
}

function actionSteps(
  intent: CapabilityIntent,
  risk: CapabilityRisk,
): DeploymentPlanStep[] {
  let actions: CapabilityRuntimeAction[];
  switch (intent) {
    case "SUSPEND":
      actions = ["compose.observe", "compose.stop_service", "compose.verify_service"];
      break;
    case "ROLLBACK":
      actions = [
        "compose.observe",
        "compose.rollback_revision",
        "compose.verify_service",
      ];
      break;
    default:
      actions = [
        "compose.observe",
        "compose.activate_profile",
        "compose.verify_service",
      ];
  }

  return actions.map((action, index) => ({
    id: `${String(index + 1).padStart(2, "0")}-${action.replace("compose.", "")}`,
    action,
    risk: action === "compose.observe" ? "low" : risk,
    requiresApproval: action !== "compose.observe",
    timeoutSeconds: action === "compose.verify_service" ? 120 : 300,
  }));
}

export function createDeploymentPlan(input: CreateDeploymentPlanInput): DeploymentPlan {
  const manifest = parseCapabilityManifest(input.manifest, input.trustPolicy);
  if (input.target.adapter !== "compose") {
    throw new UnsupportedRuntimeAdapterError(input.target.adapter);
  }
  if (!manifest.spec.runtime.adapterKinds.includes(input.target.adapter)) {
    throw new UnsupportedRuntimeAdapterError(input.target.adapter);
  }
  if (!Number.isInteger(input.configurationRevision) || input.configurationRevision < 0) {
    throw new TypeError("configurationRevision must be a non-negative integer");
  }
  if (manifest.spec.rollout.rollbackRequired && !input.rollbackTargetRevision) {
    throw new TypeError("rollbackTargetRevision is required by this capability");
  }

  const risk = riskFor(manifest);
  return {
    operationId: input.operationId,
    capabilityDigest: stableSha256Digest(manifest),
    capability: {
      name: manifest.metadata.name,
      version: manifest.metadata.version,
    },
    configurationRevision: input.configurationRevision,
    target: { ...input.target },
    resolvedDependencies: resolveCapabilityDependencies(
      manifest,
      input.availableManifests,
      input.trustPolicy,
    ),
    steps: actionSteps(input.intent, risk),
    verification: [
      { type: "health", condition: `GET ${manifest.spec.health.livenessPath}` },
      { type: "readiness", condition: `GET ${manifest.spec.health.readinessPath}` },
    ],
    rollback: manifest.spec.rollout.rollbackRequired
      ? [
          {
            action: "compose.rollback_revision",
            targetRevision: input.rollbackTargetRevision!,
          },
        ]
      : [],
  };
}

export function deploymentPlanDigest(plan: DeploymentPlan): string {
  return stableSha256Digest(plan);
}
