export type CapabilityRisk = "low" | "medium" | "high" | "critical";

export type CapabilityAdapterKind = "compose" | "railway" | "kubernetes";

export type CapabilityRuntimeAction =
  | "compose.observe"
  | "compose.activate_profile"
  | "compose.verify_service"
  | "compose.stop_service"
  | "compose.rollback_revision";

export type CapabilityDesiredState = "ACTIVE" | "SUSPENDED";

export type CapabilityObservedState =
  | "PENDING"
  | "PLANNED"
  | "AWAITING_APPROVAL"
  | "APPLYING"
  | "VERIFYING"
  | "ACTIVE"
  | "DEGRADED"
  | "SUSPENDING"
  | "SUSPENDED"
  | "ROLLING_BACK"
  | "ROLLED_BACK"
  | "BLOCKED";

export type CapabilityIntent =
  | "ACTIVATE"
  | "UPDATE"
  | "SUSPEND"
  | "ROLLBACK"
  | "RECONCILE";

export interface CapabilitySecretReference {
  name: string;
  handle: string;
}

export interface CapabilityManifestAttestation {
  scheme: "cosign";
  signer: string;
  signatureDigest: string;
}

export interface CapabilityDefinitionManifest {
  apiVersion: "semse.io/v1alpha1";
  kind: "CapabilityDefinition";
  metadata: {
    name: string;
    version: string;
    publisher: string;
    attestation?: CapabilityManifestAttestation;
  };
  spec: {
    domain: string;
    description: string;
    dependencies: {
      required: string[];
      optional: string[];
    };
    interfaces: {
      apiBasePath?: string;
      uiRoute?: string;
      mcpTools: string[];
    };
    permissions: string[];
    dataClassification: "public" | "internal" | "confidential" | "restricted";
    runtime: {
      profile: string;
      adapterKinds: CapabilityAdapterKind[];
      image: string;
    };
    configuration?: {
      secretReferences: CapabilitySecretReference[];
    };
    health: {
      livenessPath: string;
      readinessPath: string;
    };
    rollout: {
      strategy: "recreate" | "rolling" | "canary";
      rollbackRequired: boolean;
    };
  };
}

export interface CapabilityInstallation {
  id: string;
  tenantId: string;
  orgId: string;
  workspaceId: string;
  capabilityName: string;
  desiredVersion: string;
  resolvedVersion: string | null;
  desiredState: CapabilityDesiredState;
  observedState: CapabilityObservedState;
  runtimeTargetId: string;
  configurationRevision: number;
  lastOperationId: string | null;
  observedAt: string | null;
}

export interface CapabilityOperation {
  id: string;
  idempotencyKey: string;
  tenantId: string;
  workspaceId: string;
  installationId: string;
  requestedBy: {
    actorType: "user" | "agent" | "system";
    actorId: string;
  };
  intent: CapabilityIntent;
  risk: CapabilityRisk;
  policyDecisionId: string;
  planDigest: string;
  status: CapabilityObservedState;
  correlationId: string;
}

export interface ResolvedCapabilityDependency {
  name: string;
  version: string;
}

export interface DeploymentPlanStep {
  id: string;
  action: CapabilityRuntimeAction;
  risk: CapabilityRisk;
  requiresApproval: boolean;
  timeoutSeconds: number;
}

export interface DeploymentPlan {
  operationId: string;
  capabilityDigest: string;
  capability: {
    name: string;
    version: string;
  };
  configurationRevision: number;
  target: {
    adapter: CapabilityAdapterKind;
    targetId: string;
  };
  resolvedDependencies: ResolvedCapabilityDependency[];
  steps: DeploymentPlanStep[];
  verification: Array<{
    type: "health" | "readiness" | "metric";
    condition: string;
  }>;
  rollback: Array<{
    action: "compose.rollback_revision";
    targetRevision: string;
  }>;
}

export interface CapabilityOperationApproval {
  id: string;
  operationId: string;
  approvalMode: "single" | "dual";
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" | "REVOKED";
  planDigest: string;
  configurationRevision: number;
  runtimeTargetId: string;
  requestedByActorId: string;
  decidedByActorId: string | null;
  decidedByActorType: "user" | "agent" | "system" | null;
  decidedByRoles: string[];
  expiresAt: string;
  decidedAt: string | null;
  reason?: string;
}

export interface ExecutionGrant {
  grantHandle: string;
  operationId: string;
  planDigest: string;
  configurationRevision: number;
  runtimeTargetId: string;
  audience: "capability-executor";
  purpose: CapabilityRuntimeAction;
  nonce: string;
  issuedAt: string;
  expiresAt: string;
}

export interface CapabilityExecutionReceipt {
  operationId: string;
  stepId: string;
  adapterKind: CapabilityAdapterKind;
  status: "SUCCEEDED" | "FAILED" | "TIMED_OUT" | "CANCELLED";
  outputJsonRedacted: Record<string, unknown>;
  startedAt: string;
  completedAt: string;
}

export interface VerificationResult {
  passed: boolean;
  checks: Array<{
    type: "health" | "readiness" | "metric";
    passed: boolean;
    evidenceRef?: string;
  }>;
}

export interface ManifestTrustPolicy {
  trustedPublishers: readonly string[];
  trustedSignatureDigests?: readonly string[];
  requireAttestation?: boolean;
}
