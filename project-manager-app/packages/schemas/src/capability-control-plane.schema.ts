import { z } from "zod";

const nonEmptyIdSchema = z.string().trim().min(1).max(255);
const capabilityNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(63)
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/);
const publisherSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/);

export const capabilitySemverSchema = z
  .string()
  .regex(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/,
    "version must be an exact semantic version",
  );

export const capabilitySemverRangeSchema = z
  .string()
  .regex(
    /^(?:\^|~)?(?:0|[1-9]\d*)(?:\.(?:0|[1-9]\d*)){0,2}$/,
    "dependency range must be exact, caret or tilde semver",
  );

export const capabilityDigestSchema = z
  .string()
  .regex(/^sha256:[0-9a-f]{64}$/, "digest must be lowercase sha256");

export const capabilityDependencyReferenceSchema = z
  .string()
  .trim()
  .max(128)
  .superRefine((value, ctx) => {
    const separator = value.lastIndexOf("@");
    const name = value.slice(0, separator);
    const range = value.slice(separator + 1);

    if (
      separator <= 0 ||
      !capabilityNameSchema.safeParse(name).success ||
      !capabilitySemverRangeSchema.safeParse(range).success
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "dependency must use capability-name@semver-range",
      });
    }
  });

export const capabilityRiskSchema = z.enum([
  "low",
  "medium",
  "high",
  "critical",
]);

export const capabilityAdapterKindSchema = z.enum([
  "compose",
  "railway",
  "kubernetes",
]);

export const capabilityRuntimeActionSchema = z.enum([
  "compose.observe",
  "compose.activate_profile",
  "compose.verify_service",
  "compose.stop_service",
  "compose.rollback_revision",
]);

export const capabilityDesiredStateSchema = z.enum(["ACTIVE", "SUSPENDED"]);

export const capabilityObservedStateSchema = z.enum([
  "PENDING",
  "PLANNED",
  "AWAITING_APPROVAL",
  "APPLYING",
  "VERIFYING",
  "ACTIVE",
  "DEGRADED",
  "SUSPENDING",
  "SUSPENDED",
  "ROLLING_BACK",
  "ROLLED_BACK",
  "BLOCKED",
]);

export const capabilityIntentSchema = z.enum([
  "ACTIVATE",
  "UPDATE",
  "SUSPEND",
  "ROLLBACK",
  "RECONCILE",
]);

export const capabilitySecretReferenceSchema = z
  .object({
    name: capabilityNameSchema,
    handle: z
      .string()
      .trim()
      .min(10)
      .max(512)
      .regex(/^secret:\/\/[A-Za-z0-9._~/-]+$/),
  })
  .strict();

const internalHttpPathSchema = z
  .string()
  .trim()
  .min(1)
  .max(512)
  .refine(
    (value) =>
      value.startsWith("/") &&
      !value.includes("..") &&
      !value.includes("://") &&
      !value.includes("?") &&
      !value.includes("#"),
    "path must be an internal absolute HTTP path",
  );

const immutableImageReferenceSchema = z
  .string()
  .trim()
  .min(1)
  .max(512)
  .regex(
    /^[A-Za-z0-9._/-]+@sha256:[0-9a-f]{64}$/,
    "image must be pinned to an immutable sha256 digest",
  );

const capabilityAttestationSchema = z
  .object({
    scheme: z.literal("cosign"),
    signer: publisherSchema,
    signatureDigest: capabilityDigestSchema,
  })
  .strict();

const capabilityMetadataSchema = z
  .object({
    name: capabilityNameSchema,
    version: capabilitySemverSchema,
    publisher: publisherSchema,
    attestation: capabilityAttestationSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.attestation && value.attestation.signer !== value.publisher) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["attestation", "signer"],
        message: "attestation signer must match metadata.publisher",
      });
    }
  });

const capabilitySpecSchema = z
  .object({
    domain: capabilityNameSchema,
    description: z.string().trim().min(10).max(1024),
    dependencies: z
      .object({
        required: z.array(capabilityDependencyReferenceSchema).max(64),
        optional: z.array(capabilityDependencyReferenceSchema).max(64),
      })
      .strict(),
    interfaces: z
      .object({
        apiBasePath: internalHttpPathSchema.optional(),
        uiRoute: internalHttpPathSchema.optional(),
        mcpTools: z
          .array(
            z
              .string()
              .trim()
              .min(3)
              .max(128)
              .regex(/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9_-]*)+$/),
          )
          .max(128),
      })
      .strict(),
    permissions: z
      .array(
        z
          .string()
          .trim()
          .min(3)
          .max(128)
          .regex(/^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/),
      )
      .max(128),
    dataClassification: z.enum([
      "public",
      "internal",
      "confidential",
      "restricted",
    ]),
    runtime: z
      .object({
        profile: capabilityNameSchema,
        adapterKinds: z.array(capabilityAdapterKindSchema).min(1).max(3),
        image: immutableImageReferenceSchema,
      })
      .strict(),
    configuration: z
      .object({
        secretReferences: z.array(capabilitySecretReferenceSchema).max(32),
      })
      .strict()
      .optional(),
    health: z
      .object({
        livenessPath: internalHttpPathSchema,
        readinessPath: internalHttpPathSchema,
      })
      .strict(),
    rollout: z
      .object({
        strategy: z.enum(["recreate", "rolling", "canary"]),
        rollbackRequired: z.boolean(),
      })
      .strict(),
  })
  .strict();

export const capabilityDefinitionManifestSchema = z
  .object({
    apiVersion: z.literal("semse.io/v1alpha1"),
    kind: z.literal("CapabilityDefinition"),
    metadata: capabilityMetadataSchema,
    spec: capabilitySpecSchema,
  })
  .strict();

export const capabilityInstallationSchema = z
  .object({
    id: nonEmptyIdSchema,
    tenantId: nonEmptyIdSchema,
    orgId: nonEmptyIdSchema,
    workspaceId: nonEmptyIdSchema,
    capabilityName: capabilityNameSchema,
    desiredVersion: capabilitySemverRangeSchema,
    resolvedVersion: capabilitySemverSchema.nullable(),
    desiredState: capabilityDesiredStateSchema,
    observedState: capabilityObservedStateSchema,
    runtimeTargetId: nonEmptyIdSchema,
    configurationRevision: z.number().int().nonnegative(),
    lastOperationId: nonEmptyIdSchema.nullable(),
    observedAt: z.string().datetime().nullable(),
  })
  .strict();

const capabilityActorSchema = z
  .object({
    actorType: z.enum(["user", "agent", "system"]),
    actorId: nonEmptyIdSchema,
  })
  .strict();

export const capabilityOperationSchema = z
  .object({
    id: nonEmptyIdSchema,
    idempotencyKey: z.string().trim().min(1).max(512),
    tenantId: nonEmptyIdSchema,
    workspaceId: nonEmptyIdSchema,
    installationId: nonEmptyIdSchema,
    requestedBy: capabilityActorSchema,
    intent: capabilityIntentSchema,
    risk: capabilityRiskSchema,
    policyDecisionId: nonEmptyIdSchema,
    planDigest: capabilityDigestSchema,
    status: capabilityObservedStateSchema,
    correlationId: nonEmptyIdSchema,
  })
  .strict();

export const capabilityDeploymentPlanStepSchema = z
  .object({
    id: nonEmptyIdSchema,
    action: capabilityRuntimeActionSchema,
    risk: capabilityRiskSchema,
    requiresApproval: z.boolean(),
    timeoutSeconds: z.number().int().min(1).max(3600),
  })
  .strict();

export const capabilityDeploymentPlanSchema = z
  .object({
    operationId: nonEmptyIdSchema,
    capabilityDigest: capabilityDigestSchema,
    capability: z
      .object({
        name: capabilityNameSchema,
        version: capabilitySemverSchema,
      })
      .strict(),
    configurationRevision: z.number().int().nonnegative(),
    target: z
      .object({
        adapter: capabilityAdapterKindSchema,
        targetId: nonEmptyIdSchema,
      })
      .strict(),
    resolvedDependencies: z
      .array(
        z
          .object({
            name: capabilityNameSchema,
            version: capabilitySemverSchema,
          })
          .strict(),
      )
      .max(128),
    steps: z.array(capabilityDeploymentPlanStepSchema).min(1).max(128),
    verification: z
      .array(
        z
          .object({
            type: z.enum(["health", "readiness", "metric"]),
            condition: z.string().trim().min(1).max(512),
          })
          .strict(),
      )
      .max(64),
    rollback: z
      .array(
        z
          .object({
            action: z.literal("compose.rollback_revision"),
            targetRevision: nonEmptyIdSchema,
          })
          .strict(),
      )
      .max(32),
  })
  .strict();

export const capabilityOperationApprovalSchema = z
  .object({
    id: nonEmptyIdSchema,
    operationId: nonEmptyIdSchema,
    approvalMode: z.enum(["single", "dual"]),
    status: z.enum(["PENDING", "APPROVED", "REJECTED", "EXPIRED", "REVOKED"]),
    planDigest: capabilityDigestSchema,
    configurationRevision: z.number().int().nonnegative(),
    runtimeTargetId: nonEmptyIdSchema,
    requestedByActorId: nonEmptyIdSchema,
    decidedByActorId: nonEmptyIdSchema.nullable(),
    decidedByActorType: z.enum(["user", "agent", "system"]).nullable(),
    decidedByRoles: z.array(nonEmptyIdSchema).max(32),
    expiresAt: z.string().datetime(),
    decidedAt: z.string().datetime().nullable(),
    reason: z.string().trim().min(1).max(1024).optional(),
  })
  .strict();

export const capabilityExecutionGrantSchema = z
  .object({
    grantHandle: z
      .string()
      .trim()
      .min(10)
      .max(512)
      .regex(/^grant:\/\/[A-Za-z0-9._~/-]+$/),
    operationId: nonEmptyIdSchema,
    planDigest: capabilityDigestSchema,
    configurationRevision: z.number().int().nonnegative(),
    runtimeTargetId: nonEmptyIdSchema,
    audience: z.literal("capability-executor"),
    purpose: capabilityRuntimeActionSchema,
    nonce: z.string().trim().min(16).max(255),
    issuedAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const lifetimeMs = Date.parse(value.expiresAt) - Date.parse(value.issuedAt);
    if (lifetimeMs <= 0 || lifetimeMs > 120_000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expiresAt"],
        message: "execution grant lifetime must be between 1 ms and 2 minutes",
      });
    }
  });

export const capabilityExecutorRequestSchema = z
  .object({
    operationId: nonEmptyIdSchema,
    stepId: nonEmptyIdSchema,
    planDigest: capabilityDigestSchema,
    grantHandle: z
      .string()
      .trim()
      .min(10)
      .max(512)
      .regex(/^grant:\/\/[A-Za-z0-9._~/-]+$/),
  })
  .strict();

function containsUnredactedSecret(value: unknown): boolean {
  if (typeof value === "string") {
    return /(?:bearer\s+\S+|\bsk-[A-Za-z0-9_-]+|secret:\/\/)/i.test(value);
  }

  if (Array.isArray(value)) {
    return value.some(containsUnredactedSecret);
  }

  if (value && typeof value === "object") {
    return Object.entries(value).some(([key, nested]) => {
      const sensitiveKey = /(?:authorization|password|secret|token|api[_-]?key|credential)/i.test(
        key,
      );
      return (
        (sensitiveKey && nested !== "[REDACTED]") || containsUnredactedSecret(nested)
      );
    });
  }

  return false;
}

const boundedRedactedOutputSchema = z.record(z.unknown()).superRefine((value, ctx) => {
  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized, "utf8") > 32_768) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "receipt output exceeds the 32768-byte limit",
    });
  }
  if (containsUnredactedSecret(value)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "receipt output contains unredacted secret material",
    });
  }
});

export const capabilityExecutionReceiptSchema = z
  .object({
    operationId: nonEmptyIdSchema,
    stepId: nonEmptyIdSchema,
    adapterKind: capabilityAdapterKindSchema,
    status: z.enum(["SUCCEEDED", "FAILED", "TIMED_OUT", "CANCELLED"]),
    outputJsonRedacted: boundedRedactedOutputSchema,
    startedAt: z.string().datetime(),
    completedAt: z.string().datetime(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Date.parse(value.completedAt) < Date.parse(value.startedAt)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["completedAt"],
        message: "completedAt cannot be earlier than startedAt",
      });
    }
  });

export type CapabilityDefinitionManifest = z.infer<
  typeof capabilityDefinitionManifestSchema
>;
export type CapabilityInstallation = z.infer<typeof capabilityInstallationSchema>;
export type CapabilityOperation = z.infer<typeof capabilityOperationSchema>;
export type CapabilityDeploymentPlan = z.infer<
  typeof capabilityDeploymentPlanSchema
>;
export type CapabilityOperationApproval = z.infer<
  typeof capabilityOperationApprovalSchema
>;
export type CapabilityExecutionGrant = z.infer<
  typeof capabilityExecutionGrantSchema
>;
export type CapabilityExecutorRequest = z.infer<
  typeof capabilityExecutorRequestSchema
>;
export type CapabilityExecutionReceipt = z.infer<
  typeof capabilityExecutionReceiptSchema
>;
