import type {
  CapabilityAdapterKind,
  CapabilityDefinitionManifest,
  ManifestTrustPolicy,
} from "./types.js";

const exactSemverPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const semverRangePattern = /^(\^|~)?((?:0|[1-9]\d*)(?:\.(?:0|[1-9]\d*)){0,2})$/;
const namePattern = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const publisherPattern = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/;
const digestPattern = /^sha256:[0-9a-f]{64}$/;
const imagePattern = /^[A-Za-z0-9._/-]+@sha256:[0-9a-f]{64}$/;
const internalPathPattern = /^\/(?!.*(?:\.\.|:\/\/|\?|#)).{0,511}$/;
const permissionPattern = /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/;
const mcpToolPattern = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9_-]*)+$/;
const adapterKinds = new Set<CapabilityAdapterKind>([
  "compose",
  "railway",
  "kubernetes",
]);

interface ParsedSemver {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
}

export interface ParsedDependencyReference {
  name: string;
  range: string;
}

export class CapabilityManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CapabilityManifestError";
  }
}

export class ManifestTrustError extends CapabilityManifestError {
  constructor(message: string) {
    super(message);
    this.name = "ManifestTrustError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new CapabilityManifestError(`${path} must be an object`);
  }
  return value;
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new CapabilityManifestError(`${path} must be a non-empty string`);
  }
  return value;
}

function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
): void {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    throw new CapabilityManifestError(
      `${path} contains unsupported fields: ${unknown.sort().join(", ")}`,
    );
  }
}

export function parseExactSemver(value: string): ParsedSemver {
  const match = value.match(exactSemverPattern);
  if (!match) {
    throw new CapabilityManifestError(`invalid exact semantic version: ${value}`);
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    ...(match[4] ? { prerelease: match[4] } : {}),
  };
}

export function compareSemver(left: string, right: string): number {
  const a = parseExactSemver(left);
  const b = parseExactSemver(right);
  for (const key of ["major", "minor", "patch"] as const) {
    if (a[key] !== b[key]) {
      return a[key] - b[key];
    }
  }
  if (a.prerelease === b.prerelease) return 0;
  if (a.prerelease === undefined) return 1;
  if (b.prerelease === undefined) return -1;
  return a.prerelease < b.prerelease ? -1 : 1;
}

export function parseDependencyReference(value: string): ParsedDependencyReference {
  const separator = value.lastIndexOf("@");
  const name = value.slice(0, separator);
  const range = value.slice(separator + 1);
  if (separator <= 0 || !namePattern.test(name) || !semverRangePattern.test(range)) {
    throw new CapabilityManifestError(
      `dependency must use capability-name@semver-range: ${value}`,
    );
  }
  return { name, range };
}

function compareParts(
  version: ParsedSemver,
  target: Pick<ParsedSemver, "major" | "minor" | "patch">,
): number {
  if (version.major !== target.major) return version.major - target.major;
  if (version.minor !== target.minor) return version.minor - target.minor;
  return version.patch - target.patch;
}

export function satisfiesSemverRange(versionValue: string, rangeValue: string): boolean {
  const version = parseExactSemver(versionValue);
  if (version.prerelease) return false;

  const rangeMatch = rangeValue.match(semverRangePattern);
  if (!rangeMatch) {
    throw new CapabilityManifestError(`invalid semantic version range: ${rangeValue}`);
  }
  const operator = rangeMatch[1] ?? "";
  const rawParts = (rangeMatch[2] ?? "").split(".").map(Number);
  const specifiedParts = rawParts.length;
  const target = {
    major: rawParts[0] ?? 0,
    minor: rawParts[1] ?? 0,
    patch: rawParts[2] ?? 0,
  };
  if (compareParts(version, target) < 0) return false;

  if (operator === "^") {
    if (target.major > 0) return version.major === target.major;
    if (target.minor > 0) {
      return version.major === 0 && version.minor === target.minor;
    }
    return version.major === 0 && version.minor === 0 && version.patch === target.patch;
  }
  if (operator === "~") {
    if (specifiedParts === 1) return version.major === target.major;
    return version.major === target.major && version.minor === target.minor;
  }
  if (specifiedParts === 1) return version.major === target.major;
  if (specifiedParts === 2) {
    return version.major === target.major && version.minor === target.minor;
  }
  return compareParts(version, target) === 0;
}

function validateDependencyList(value: unknown, path: string): string[] {
  if (!Array.isArray(value) || value.length > 64) {
    throw new CapabilityManifestError(`${path} must be an array of at most 64 entries`);
  }
  const dependencies = value.map((entry, index) =>
    requireString(entry, `${path}[${index}]`),
  );
  dependencies.forEach(parseDependencyReference);
  if (new Set(dependencies.map((entry) => parseDependencyReference(entry).name)).size !== dependencies.length) {
    throw new CapabilityManifestError(`${path} contains duplicate capability names`);
  }
  return dependencies;
}

function validateStringArray(
  value: unknown,
  path: string,
  pattern: RegExp,
  maximum: number,
): string[] {
  if (!Array.isArray(value) || value.length > maximum) {
    throw new CapabilityManifestError(`${path} must be an array of at most ${maximum} entries`);
  }
  const entries = value.map((entry, index) => requireString(entry, `${path}[${index}]`));
  if (entries.some((entry) => !pattern.test(entry))) {
    throw new CapabilityManifestError(`${path} contains an invalid entry`);
  }
  if (new Set(entries).size !== entries.length) {
    throw new CapabilityManifestError(`${path} contains duplicate entries`);
  }
  return entries;
}

export function validateCapabilityManifestStructure(
  input: unknown,
): CapabilityDefinitionManifest {
  const manifest = requireRecord(input, "manifest");
  rejectUnknownKeys(manifest, ["apiVersion", "kind", "metadata", "spec"], "manifest");
  if (manifest.apiVersion !== "semse.io/v1alpha1") {
    throw new CapabilityManifestError("manifest.apiVersion is unsupported");
  }
  if (manifest.kind !== "CapabilityDefinition") {
    throw new CapabilityManifestError("manifest.kind is unsupported");
  }

  const metadata = requireRecord(manifest.metadata, "manifest.metadata");
  rejectUnknownKeys(metadata, ["name", "version", "publisher", "attestation"], "manifest.metadata");
  const name = requireString(metadata.name, "manifest.metadata.name");
  const version = requireString(metadata.version, "manifest.metadata.version");
  const publisher = requireString(metadata.publisher, "manifest.metadata.publisher");
  if (!namePattern.test(name) || !publisherPattern.test(publisher)) {
    throw new CapabilityManifestError("manifest name or publisher has an invalid format");
  }
  parseExactSemver(version);

  if (metadata.attestation !== undefined) {
    const attestation = requireRecord(metadata.attestation, "manifest.metadata.attestation");
    rejectUnknownKeys(
      attestation,
      ["scheme", "signer", "signatureDigest"],
      "manifest.metadata.attestation",
    );
    if (
      attestation.scheme !== "cosign" ||
      attestation.signer !== publisher ||
      typeof attestation.signatureDigest !== "string" ||
      !digestPattern.test(attestation.signatureDigest)
    ) {
      throw new CapabilityManifestError("manifest attestation is invalid");
    }
  }

  const spec = requireRecord(manifest.spec, "manifest.spec");
  rejectUnknownKeys(
    spec,
    [
      "domain",
      "description",
      "dependencies",
      "interfaces",
      "permissions",
      "dataClassification",
      "runtime",
      "configuration",
      "health",
      "rollout",
    ],
    "manifest.spec",
  );
  const domain = requireString(spec.domain, "manifest.spec.domain");
  const description = requireString(spec.description, "manifest.spec.description");
  if (!namePattern.test(domain) || description.trim().length < 10 || description.length > 1024) {
    throw new CapabilityManifestError("manifest domain or description is invalid");
  }

  const dependencies = requireRecord(spec.dependencies, "manifest.spec.dependencies");
  rejectUnknownKeys(dependencies, ["required", "optional"], "manifest.spec.dependencies");
  const requiredDependencies = validateDependencyList(
    dependencies.required,
    "manifest.spec.dependencies.required",
  );
  const optionalDependencies = validateDependencyList(
    dependencies.optional,
    "manifest.spec.dependencies.optional",
  );
  const allDependencyNames = [...requiredDependencies, ...optionalDependencies].map(
    (entry) => parseDependencyReference(entry).name,
  );
  if (new Set(allDependencyNames).size !== allDependencyNames.length) {
    throw new CapabilityManifestError("a dependency cannot be both required and optional");
  }

  const runtime = requireRecord(spec.runtime, "manifest.spec.runtime");
  rejectUnknownKeys(runtime, ["profile", "adapterKinds", "image"], "manifest.spec.runtime");
  const profile = requireString(runtime.profile, "manifest.spec.runtime.profile");
  if (!namePattern.test(profile)) {
    throw new CapabilityManifestError("manifest.spec.runtime.profile is invalid");
  }
  if (
    !Array.isArray(runtime.adapterKinds) ||
    runtime.adapterKinds.length === 0 ||
    runtime.adapterKinds.length > 3 ||
    new Set(runtime.adapterKinds).size !== runtime.adapterKinds.length ||
    runtime.adapterKinds.some((kind) => !adapterKinds.has(kind as CapabilityAdapterKind))
  ) {
    throw new CapabilityManifestError("manifest.spec.runtime.adapterKinds is invalid");
  }
  if (typeof runtime.image !== "string" || !imagePattern.test(runtime.image)) {
    throw new CapabilityManifestError("manifest runtime image must use an immutable digest");
  }

  if (spec.configuration !== undefined) {
    const configuration = requireRecord(spec.configuration, "manifest.spec.configuration");
    rejectUnknownKeys(configuration, ["secretReferences"], "manifest.spec.configuration");
    if (
      !Array.isArray(configuration.secretReferences) ||
      configuration.secretReferences.length > 32
    ) {
      throw new CapabilityManifestError("secretReferences must be an array");
    }
    for (const [index, entry] of configuration.secretReferences.entries()) {
      const reference = requireRecord(entry, `secretReferences[${index}]`);
      rejectUnknownKeys(reference, ["name", "handle"], `secretReferences[${index}]`);
      if (
        typeof reference.name !== "string" ||
        !namePattern.test(reference.name) ||
        typeof reference.handle !== "string" ||
        !/^secret:\/\/[A-Za-z0-9._~/-]+$/.test(reference.handle)
      ) {
        throw new CapabilityManifestError(`secretReferences[${index}] is invalid`);
      }
    }
  }

  const interfaces = requireRecord(spec.interfaces, "manifest.spec.interfaces");
  rejectUnknownKeys(interfaces, ["apiBasePath", "uiRoute", "mcpTools"], "manifest.spec.interfaces");
  for (const pathKey of ["apiBasePath", "uiRoute"] as const) {
    const path = interfaces[pathKey];
    if (path !== undefined && (typeof path !== "string" || !internalPathPattern.test(path))) {
      throw new CapabilityManifestError(`manifest.spec.interfaces.${pathKey} is invalid`);
    }
  }
  validateStringArray(interfaces.mcpTools, "manifest.spec.interfaces.mcpTools", mcpToolPattern, 128);
  validateStringArray(spec.permissions, "manifest.spec.permissions", permissionPattern, 128);
  if (
    !["public", "internal", "confidential", "restricted"].includes(
      String(spec.dataClassification),
    )
  ) {
    throw new CapabilityManifestError("manifest.spec.dataClassification is invalid");
  }

  const health = requireRecord(spec.health, "manifest.spec.health");
  rejectUnknownKeys(health, ["livenessPath", "readinessPath"], "manifest.spec.health");
  if (
    typeof health.livenessPath !== "string" ||
    !internalPathPattern.test(health.livenessPath) ||
    typeof health.readinessPath !== "string" ||
    !internalPathPattern.test(health.readinessPath)
  ) {
    throw new CapabilityManifestError("manifest health paths are invalid");
  }

  const rollout = requireRecord(spec.rollout, "manifest.spec.rollout");
  rejectUnknownKeys(rollout, ["strategy", "rollbackRequired"], "manifest.spec.rollout");
  if (
    !["recreate", "rolling", "canary"].includes(String(rollout.strategy)) ||
    typeof rollout.rollbackRequired !== "boolean"
  ) {
    throw new CapabilityManifestError("manifest rollout is invalid");
  }

  return input as CapabilityDefinitionManifest;
}

export function validateManifestTrust(
  manifest: CapabilityDefinitionManifest,
  policy: ManifestTrustPolicy,
): void {
  if (!policy.trustedPublishers.includes(manifest.metadata.publisher)) {
    throw new ManifestTrustError(
      `publisher is not trusted: ${manifest.metadata.publisher}`,
    );
  }
  const attestation = manifest.metadata.attestation;
  if (policy.requireAttestation && !attestation) {
    throw new ManifestTrustError("a trusted manifest attestation is required");
  }
  if (
    attestation &&
    policy.trustedSignatureDigests &&
    !policy.trustedSignatureDigests.includes(attestation.signatureDigest)
  ) {
    throw new ManifestTrustError("manifest signature digest is not trusted");
  }
}

export function parseCapabilityManifest(
  input: unknown,
  trustPolicy?: ManifestTrustPolicy,
): CapabilityDefinitionManifest {
  const manifest = validateCapabilityManifestStructure(input);
  if (trustPolicy) validateManifestTrust(manifest, trustPolicy);
  return manifest;
}
