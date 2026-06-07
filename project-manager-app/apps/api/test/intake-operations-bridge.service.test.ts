import test from "node:test";
import assert from "node:assert/strict";
import { IntakeOperationsBridgeService } from "../dist/modules/intake-operations-bridge/intake-operations-bridge.service.js";

function createFakePrisma() {
  const state = {
    jobs: [
      {
        id: "job_bridge_1",
        tenantId: "tenant_default",
        clientOrgId: "org_client_001",
        title: "Bridge test painting job",
        category: "Pintura interior",
        scope: "Paint the living room walls and touch up trim.",
        status: "POSTED",
        location: "Miami, FL",
        urgency: "medium",
        budgetMin: null,
        budgetMax: null,
        clientOrg: { name: "ACME Corp (Cliente)" },
      },
    ],
    intakes: [
      {
        id: "intk_bridge_1",
        tenantId: "tenant_default",
        userId: "usr_client_001",
        sessionToken: "session_bridge_1",
        publishedJobId: "job_bridge_1",
        rawDescription: "Necesito pintar la sala y retocar molduras.",
        providedTitle: "Paint living room",
        normalizedTitle: "Paint Living Room",
        selectedCategoryId: "pintura",
        selectedSubcategoryId: "interior",
        detectedCategory: "interior_painting",
        detectedSubcategory: "interior",
        modality: "on_site",
        city: "Miami, FL",
        urgency: "medium",
        detectedLanguage: "es",
        categoryConfidence: 0.98,
        accuracyScore: 48,
        accuracyLevel: "good",
        missingFields: [],
        recommendedFields: [],
        answersJson: [],
        uploadedImagesJson: [],
        estimatePreferenceJson: {
          includeMaterials: true,
          includeLabor: true,
          pricingMode: "per_area",
        },
        projectScopeJson: {
          area: {
            value: 240,
            unit: "sqft",
            range: "220-260 sqft",
            confidence: "estimated",
          },
          condition: {
            value: "good",
          },
          paintCoats: {
            value: 2,
            notSure: false,
          },
        },
        generatedEstimateJson: {
          id: "est_1",
          intakeId: "intk_bridge_1",
          totalRange: {
            min: 950,
            max: 1350,
            currency: "USD",
          },
          breakdown: {
            materials: { min: 180, max: 260, currency: "USD" },
            labor: { min: 520, max: 760, currency: "USD" },
            preparation: { min: 120, max: 160, currency: "USD" },
            contingency: { min: 130, max: 170, currency: "USD" },
          },
          includes: ["materials", "labor"],
          excludes: [],
          assumptions: ["Client clears furniture before work starts."],
          confidence: "medium",
          confidenceReasons: ["Area and coats were provided."],
          accuracyScoreAtGeneration: 48,
          generatedAt: new Date().toISOString(),
          generatedBy: "smart_intake_formula",
        },
        generatedMilestonesJson: [
          {
            id: "milestone_1",
            intakeId: "intk_bridge_1",
            order: 1,
            title: { es: "Preparacion", en: "Preparation" },
            description: { es: "Preparar el area", en: "Prepare the work area" },
            estimatedDurationHours: 2,
            dependencies: [],
            paymentPercentage: 25,
            requiresEvidence: true,
            status: "pending",
          },
          {
            id: "milestone_2",
            intakeId: "intk_bridge_1",
            order: 2,
            title: { es: "Pintura", en: "Painting" },
            description: { es: "Aplicar pintura", en: "Apply paint" },
            estimatedDurationHours: 6,
            dependencies: ["milestone_1"],
            paymentPercentage: 50,
            requiresEvidence: true,
            status: "pending",
          },
          {
            id: "milestone_3",
            intakeId: "intk_bridge_1",
            order: 3,
            title: { es: "Cierre", en: "Closeout" },
            description: { es: "Inspeccion final", en: "Final inspection" },
            estimatedDurationHours: 1,
            dependencies: ["milestone_2"],
            paymentPercentage: 25,
            requiresEvidence: true,
            status: "pending",
          },
        ],
        activeWarningsJson: [],
        status: "published",
        createdAt: new Date(),
        updatedAt: new Date(),
        claimedAt: new Date(),
        publishedAt: new Date(),
        expiresAt: null,
      },
    ],
    buildOpsProjects: [] as Array<Record<string, unknown>>,
    buildOpsTasks: [] as Array<Record<string, unknown>>,
  };

  const prisma = {
    job: {
      findFirst: async ({ where }: { where: { id: string; tenantId: string } }) =>
        state.jobs.find((job) => job.id === where.id && job.tenantId === where.tenantId) ?? null,
    },
    projectIntake: {
      findFirst: async ({ where }: { where: { tenantId: string; publishedJobId: string } }) =>
        state.intakes.find((intake) => intake.tenantId === where.tenantId && intake.publishedJobId === where.publishedJobId) ?? null,
    },
    buildOpsProject: {
      findFirst: async ({ where }: { where: { tenantId: string; jobId: string } }) =>
        state.buildOpsProjects.find((project) => project["tenantId"] === where.tenantId && project["jobId"] === where.jobId) ?? null,
      findUnique: async ({ where }: { where: { jobId: string } }) =>
        state.buildOpsProjects.find((project) => project["jobId"] === where.jobId) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: `bop_${state.buildOpsProjects.length + 1}`,
          sourceToolResult: data["sourceToolResult"] ?? null,
          completion: data["completion"] ?? 0,
          ...data,
        };
        state.buildOpsProjects.push(row);
        return { id: String(row.id) };
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const index = state.buildOpsProjects.findIndex((project) => project["id"] === where.id);
        assert.notEqual(index, -1);
        state.buildOpsProjects[index] = {
          ...state.buildOpsProjects[index],
          ...data,
        };
        return { id: String(state.buildOpsProjects[index]?.["id"]) };
      },
    },
    buildOpsTask: {
      findMany: async ({ where }: { where: { projectId: string } }) =>
        state.buildOpsTasks.filter((task) => task["projectId"] === where.projectId),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = {
          id: `bot_${state.buildOpsTasks.length + 1}`,
          ...data,
        };
        state.buildOpsTasks.push(row);
        return { id: String(row.id) };
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const index = state.buildOpsTasks.findIndex((task) => task["id"] === where.id);
        assert.notEqual(index, -1);
        state.buildOpsTasks[index] = {
          ...state.buildOpsTasks[index],
          ...data,
        };
        return { id: String(state.buildOpsTasks[index]?.["id"]) };
      },
    },
  };

  return { prisma, state };
}

function createServiceHarness() {
  const { prisma, state } = createFakePrisma();
  const matchingService = {
    async matchJob() {
      return {
        candidatesEvaluated: 0,
        candidates: [],
        preferredCandidateStatus: null,
        algorithmVersion: "test",
        computedAt: new Date().toISOString(),
      };
    },
  };
  const paymentsService = {
    async paymentReadinessByJob() {
      return {
        jobId: "job_bridge_1",
        ready: false,
        checks: {
          acceptedReservation: false,
          activeContract: false,
          signedClient: false,
          signedProfessional: false,
          projectLinked: false,
        },
        reasons: ["Falta una reserva aceptada para este trabajo."],
        reservationId: null,
        contractId: null,
      };
    },
  };
  const toolsService = {
    calculate() {
      return {
        toolId: "painting-tool-test",
        trade: "painting",
        projectType: "interior-painting",
        mode: "professional",
        inputs: {},
        validationIssues: [],
        isValid: true,
        materials: [],
        labor: {
          hours: 10,
          crewSize: 2,
          days: 2,
          ratePerHour: 52,
          totalCost: 520,
          difficulty: "moderate",
          notes: [],
        },
        costs: {
          materials: 220,
          labor: 520,
          overhead: 0,
          profit: 0,
          semseFee: 0,
          taxes: 0,
          total: 740,
          currency: "USD",
        },
        risk: {
          level: "medium",
          score: 42,
          factors: [],
          requiresPermit: false,
          requiresLicense: false,
          requiresInspection: false,
          requiresEngineering: false,
        },
        milestones: [
          {
            sequence: 1,
            title: "Prep",
            description: "Prep",
            percentage: 30,
            amount: 300,
            evidenceRequired: ["before_photos"],
            releaseTrigger: "approved_progress_evidence",
          },
          {
            sequence: 2,
            title: "Execution",
            description: "Execution",
            percentage: 50,
            amount: 500,
            evidenceRequired: ["progress_photos"],
            releaseTrigger: "approved_progress_evidence",
          },
          {
            sequence: 3,
            title: "Closeout",
            description: "Closeout",
            percentage: 20,
            amount: 200,
            evidenceRequired: ["after_photos", "client_approval"],
            releaseTrigger: "final_approval",
          },
        ],
        evidenceRequired: [
          { type: "photo", description: "Before photos", required: true, milestone: 1 },
          { type: "photo", description: "Progress photos", required: true, milestone: 2 },
          { type: "document", description: "Client approval", required: true, milestone: 3 },
        ],
        warnings: [],
        recommendations: ["Confirm color and finish before starting."],
        assumptions: ["Derived from smart intake bridge."],
        createdAt: new Date().toISOString(),
      };
    },
    quote(result: { costs: { materials: number; labor: number } }) {
      return {
        materials: result.costs.materials,
        labor: result.costs.labor,
        overhead: 100,
        profit: 150,
        semseFee: 40,
        contingency: 80,
        taxes: 50,
        subtotal: 740,
        total: 1160,
        recommendedDeposit: 406,
        recommendedEscrow: 754,
        currency: "USD",
        notes: [],
      };
    },
    milestones(result: { milestones: unknown[]; trade: string; risk: { level: string } }) {
      return {
        trade: result.trade,
        totalAmount: 1160,
        riskLevel: result.risk.level,
        milestones: result.milestones,
        fundingSchedule: [300, 500, 200],
      };
    },
    evidence(result: { trade: string; risk: { level: string }; evidenceRequired: unknown[] }) {
      return {
        trade: result.trade,
        riskLevel: result.risk.level,
        requiredCount: 3,
        items: result.evidenceRequired,
        notes: [],
      };
    },
    escrow() {
      return {
        trade: "painting",
        totalAmount: 1160,
        initialDeposit: 406,
        holdback: 116,
        releaseSchedule: [300, 500, 200],
        recommendedReserve: 92.8,
        notes: [],
      };
    },
  };

  const service = new IntakeOperationsBridgeService(
    prisma as never,
    matchingService as never,
    paymentsService as never,
    toolsService as never,
  );

  return { service, state };
}

test("bridgePublishedJobToOperations creates buildops project and base tasks once", async () => {
  const { service, state } = createServiceHarness();

  const first = await service.bridgePublishedJobToOperations({
    jobId: "job_bridge_1",
    tenantId: "tenant_default",
    orgId: "org_client_001",
    userId: "usr_client_001",
    roles: ["CLIENT"],
  });

  assert.equal(first.projectIntakeId, "intk_bridge_1");
  assert.equal(first.jobId, "job_bridge_1");
  assert.equal(first.tasksCreated, 6);
  assert.equal(first.tasksReused, 0);
  assert.equal(first.estimate.status, "ready");
  assert.equal(first.idempotency.reusedBuildOpsProject, false);
  assert.equal(state.buildOpsProjects.length, 1);
  assert.equal(state.buildOpsTasks.length, 6);
  assert.equal((state.buildOpsProjects[0]?.sourceToolResult as Record<string, unknown>)?.schemaVersion, "1.0");

  const second = await service.bridgePublishedJobToOperations({
    jobId: "job_bridge_1",
    tenantId: "tenant_default",
    orgId: "org_client_001",
    userId: "usr_client_001",
    roles: ["CLIENT"],
  });

  assert.equal(second.buildOpsProjectId, first.buildOpsProjectId);
  assert.equal(second.tasksCreated, 0);
  assert.equal(second.tasksReused, 6);
  assert.equal(second.idempotency.reusedBuildOpsProject, true);
  assert.equal(second.idempotency.reusedTasks, true);
  assert.equal(state.buildOpsProjects.length, 1);
  assert.equal(state.buildOpsTasks.length, 6);
});
