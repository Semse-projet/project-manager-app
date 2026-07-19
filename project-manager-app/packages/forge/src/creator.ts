import type {
  CreatorAppBlueprint,
  ForgeSpecReference,
  ForgeTaskPacket
} from "./types.js";

type CryptoSubtle = {
  digest(algorithm: string, data: ArrayBufferView): Promise<ArrayBuffer>;
};

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const subtle = (globalThis as unknown as { crypto?: { subtle?: CryptoSubtle } }).crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto API not available: cannot compute creator blueprint digest");
  }
  const buffer = await subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export type CreatorBlueprintValidation = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

export function validateCreatorBlueprint(
  blueprint: CreatorAppBlueprint
): CreatorBlueprintValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!blueprint.title.trim()) errors.push("title is required");
  if (!blueprint.domain.trim()) errors.push("domain is required");
  if (blueprint.learningObjectives.length === 0) {
    errors.push("at least one learning objective is required");
  }
  if (blueprint.modules.length === 0) errors.push("at least one module is required");
  if (blueprint.languages.length === 0) errors.push("at least one language is required");

  const unlicensed = blueprint.knowledgeSources.filter(
    (source) => !source.rightsConfirmed
  );
  if (unlicensed.length > 0) {
    errors.push("all knowledge sources must have confirmed rights");
  }

  if (
    blueprint.visibility === "marketplace" &&
    blueprint.assessments.length === 0
  ) {
    warnings.push("marketplace learning apps should include at least one assessment");
  }

  if (
    blueprint.monetization.model !== "free" &&
    (!blueprint.monetization.priceCents ||
      blueprint.monetization.priceCents <= 0)
  ) {
    errors.push("paid monetization requires a positive priceCents");
  }

  return { valid: errors.length === 0, errors, warnings };
}

export async function creatorBlueprintToSpec(
  blueprint: CreatorAppBlueprint
): Promise<ForgeSpecReference> {
  const validation = validateCreatorBlueprint(blueprint);
  if (!validation.valid) {
    throw new Error(`Invalid creator blueprint: ${validation.errors.join("; ")}`);
  }

  const digest = await sha256Hex(JSON.stringify(blueprint));

  return {
    id: `creator-${blueprint.id}`,
    path: `docs/specs/creator/apps/${blueprint.id}.spec.md`,
    digest,
    status: "DRAFT"
  };
}

export function createCreatorTaskPackets(
  blueprint: CreatorAppBlueprint,
  approvedSpec: ForgeSpecReference
): ForgeTaskPacket[] {
  if (approvedSpec.status !== "APPROVED") {
    throw new Error("Creator task packets require an APPROVED spec");
  }

  const base: Pick<
    ForgeTaskPacket,
    "spec" | "riskLevel" | "forbiddenFiles" | "targetBranch" | "environment" | "metadata"
  > = {
    spec: approvedSpec,
    riskLevel: blueprint.dataClassification === "regulated" ? "critical" : "high",
    forbiddenFiles: ["packages/db/prisma/migrations/**", "railway.json", ".env*"],
    targetBranch: `agent/creator-${blueprint.id}`,
    environment: "sandbox",
    metadata: {
      creatorId: blueprint.creatorId,
      blueprintId: blueprint.id,
      domain: blueprint.domain
    }
  };

  return [
    {
      ...base,
      id: `${blueprint.id}:knowledge`,
      title: "Structure creator knowledge and curriculum",
      requestedRole: "creator-mentor",
      objective: "Turn validated knowledge sources into modules, objectives and assessments.",
      allowedFiles: ["docs/specs/creator/**", ".semse-sdd/forge/creator/**"],
      allowedCommands: [],
      acceptanceCriteria: [
        {
          id: "creator-knowledge-1",
          statement: "Every module maps to at least one learning objective.",
          verification: "blueprint traceability review",
          required: true
        }
      ],
      dependencies: []
    },
    {
      ...base,
      id: `${blueprint.id}:ux`,
      title: "Compose creator application UX",
      requestedRole: "ux-composer",
      objective: "Produce accessible creator and learner flows from the approved spec.",
      allowedFiles: ["apps/web/**", "packages/ui/**", "tests/e2e-semse/**"],
      allowedCommands: ["pnpm --filter @semse/web build", "pnpm test:e2e:semse"],
      acceptanceCriteria: [
        {
          id: "creator-ux-1",
          statement: "Creator can preview the app before publication.",
          verification: "Playwright creator preview scenario",
          required: true
        }
      ],
      dependencies: [`${blueprint.id}:knowledge`]
    },
    {
      ...base,
      id: `${blueprint.id}:backend`,
      title: "Implement creator application backend",
      requestedRole: "backend-builder",
      objective: "Implement versioned blueprint, modules, assessments and publication proposal APIs.",
      allowedFiles: ["apps/api/**", "packages/schemas/**", "tests/**"],
      allowedCommands: ["pnpm build:api", "pnpm test:unit"],
      acceptanceCriteria: [
        {
          id: "creator-api-1",
          statement: "Publishing is proposal-only and cannot bypass approval.",
          verification: "unit and integration tests",
          required: true
        }
      ],
      dependencies: [`${blueprint.id}:knowledge`]
    },
    {
      ...base,
      id: `${blueprint.id}:verify`,
      title: "Verify creator application",
      requestedRole: "qa-verifier",
      objective: "Execute the complete validation matrix and attach evidence.",
      allowedFiles: ["tests/**", "docs/reportes/**", ".semse-sdd/**"],
      allowedCommands: [
        "pnpm spec:validate:strict",
        "pnpm typecheck",
        "pnpm test:unit",
        "pnpm build:web",
        "pnpm build:api"
      ],
      acceptanceCriteria: [
        {
          id: "creator-verify-1",
          statement: "All required validation matrix items pass.",
          verification: "machine-readable verification report",
          required: true
        }
      ],
      dependencies: [`${blueprint.id}:ux`, `${blueprint.id}:backend`]
    }
  ];
}
