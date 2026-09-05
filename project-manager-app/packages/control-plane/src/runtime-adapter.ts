import type {
  CapabilityAdapterKind,
  CapabilityExecutionReceipt,
  CapabilityInstallation,
  CapabilityObservedState,
  CapabilityRuntimeAction,
  DeploymentPlan,
  ExecutionGrant,
  VerificationResult,
} from "./types.js";

export const CAPABILITY_RUNTIME_ACTIONS = [
  "compose.observe",
  "compose.activate_profile",
  "compose.verify_service",
  "compose.stop_service",
  "compose.rollback_revision",
] as const satisfies readonly CapabilityRuntimeAction[];

export interface ObserveRequest {
  installationId: string;
  runtimeTargetId: string;
}

export interface ObservedRuntimeState {
  installationId: string;
  runtimeTargetId: string;
  observedState: CapabilityObservedState;
  observedRevision: string | null;
  observedAt: string;
}

export interface DesiredRuntimeState {
  installation: CapabilityInstallation;
  desiredVersion: string;
}

export interface ApplyReceipt extends CapabilityExecutionReceipt {
  status: "SUCCEEDED" | "FAILED" | "TIMED_OUT" | "CANCELLED";
}

export interface RollbackReceipt extends CapabilityExecutionReceipt {
  status: "SUCCEEDED" | "FAILED" | "TIMED_OUT" | "CANCELLED";
}

export interface RuntimeAdapter {
  readonly kind: CapabilityAdapterKind;
  observe(input: ObserveRequest): Promise<ObservedRuntimeState>;
  plan(input: DesiredRuntimeState): Promise<DeploymentPlan>;
  apply(plan: DeploymentPlan, grant: ExecutionGrant): Promise<ApplyReceipt>;
  verify(receipt: ApplyReceipt): Promise<VerificationResult>;
  rollback(plan: DeploymentPlan, grant: ExecutionGrant): Promise<RollbackReceipt>;
}
