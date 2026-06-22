import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { PaymentGovernanceService } from "./payment-governance.service.js";
import { PaymentGovernanceRepository } from "./payment-governance.repository.js";
import { PaymentGovernanceDiagnosticsService } from "./diagnostics.service.js";

describe("PaymentGovernanceService", () => {
  let service: PaymentGovernanceService;
  let repository: jest.Mocked<PaymentGovernanceRepository>;
  let diagnostics: jest.Mocked<PaymentGovernanceDiagnosticsService>;

  const mockRepository = {
    getEscrow: jest.fn(),
    getMilestoneEvidence: jest.fn(),
    countPendingChangeOrders: jest.fn(),
    createPaymentTransaction: jest.fn(),
    updateEscrowStatus: jest.fn(),
    logPaymentDecision: jest.fn(),
  };

  const mockDiagnostics = {
    getDiagnostics: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentGovernanceService,
        { provide: PaymentGovernanceRepository, useValue: mockRepository },
        { provide: PaymentGovernanceDiagnosticsService, useValue: mockDiagnostics },
      ],
    }).compile();

    service = module.get<PaymentGovernanceService>(
      PaymentGovernanceService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("releasePayment", () => {
    it("should release payment successfully when no blockers exist", async () => {
      const escrowId = "escrow-123";
      const milestoneId = "milestone-123";

      mockRepository.getEscrow.mockResolvedValue({
        id: escrowId,
        projectId: "project-123",
        status: "ACTIVE",
      } as any);
      mockRepository.getMilestoneEvidence.mockResolvedValue([
        {
          id: "ev-1",
          validationStatus: "passed",
          validationScore: 0.9,
        },
      ] as any);
      mockRepository.countPendingChangeOrders.mockResolvedValue(0);
      mockRepository.createPaymentTransaction.mockResolvedValue({
        id: "txn-123",
      } as any);

      const result = await service.releasePayment({
        escrowId,
        milestoneId,
        amount: 1000,
        reason: "Milestone completed successfully",
        releasedBy: "user-123",
      });

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe("txn-123");
    });

    it("should block payment when escrow not found", async () => {
      mockRepository.getEscrow.mockResolvedValue(null);

      await expect(
        service.releasePayment({
          escrowId: "invalid",
          milestoneId: "milestone-123",
          amount: 1000,
          reason: "test",
          releasedBy: "user-123",
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should block payment when pending change orders exist", async () => {
      const escrowId = "escrow-123";
      const milestoneId = "milestone-123";

      mockRepository.getEscrow.mockResolvedValue({
        id: escrowId,
        projectId: "project-123",
        status: "ACTIVE",
      } as any);
      mockRepository.getMilestoneEvidence.mockResolvedValue([
        { id: "ev-1", validationStatus: "passed", validationScore: 0.9 },
      ] as any);
      mockRepository.countPendingChangeOrders.mockResolvedValue(2);

      const result = await service.releasePayment({
        escrowId,
        milestoneId,
        amount: 1000,
        reason: "test",
        releasedBy: "user-123",
      });

      expect(result.success).toBe(false);
      expect(result.blockers).toContain("pending_change_orders");
    });

    it("should block payment when evidence is missing", async () => {
      const escrowId = "escrow-123";
      const milestoneId = "milestone-123";

      mockRepository.getEscrow.mockResolvedValue({
        id: escrowId,
        projectId: "project-123",
        status: "ACTIVE",
      } as any);
      mockRepository.getMilestoneEvidence.mockResolvedValue([] as any);
      mockRepository.countPendingChangeOrders.mockResolvedValue(0);

      const result = await service.releasePayment({
        escrowId,
        milestoneId,
        amount: 1000,
        reason: "test",
        releasedBy: "user-123",
      });

      expect(result.success).toBe(false);
      expect(result.blockers).toContain("missing_evidence");
    });

    it("should block payment when evidence is rejected", async () => {
      const escrowId = "escrow-123";
      const milestoneId = "milestone-123";

      mockRepository.getEscrow.mockResolvedValue({
        id: escrowId,
        projectId: "project-123",
        status: "ACTIVE",
      } as any);
      mockRepository.getMilestoneEvidence.mockResolvedValue([
        { id: "ev-1", validationStatus: "failed", validationScore: 0.2 },
      ] as any);
      mockRepository.countPendingChangeOrders.mockResolvedValue(0);

      const result = await service.releasePayment({
        escrowId,
        milestoneId,
        amount: 1000,
        reason: "test",
        releasedBy: "user-123",
      });

      expect(result.success).toBe(false);
      expect(result.blockers).toContain("rejected_evidence");
    });

    it("should block payment when escrow is blocked", async () => {
      const escrowId = "escrow-123";
      const milestoneId = "milestone-123";

      mockRepository.getEscrow.mockResolvedValue({
        id: escrowId,
        projectId: "project-123",
        status: "PENDING_SETTLEMENT",
      } as any);
      mockRepository.getMilestoneEvidence.mockResolvedValue([
        { id: "ev-1", validationStatus: "passed", validationScore: 0.9 },
      ] as any);
      mockRepository.countPendingChangeOrders.mockResolvedValue(0);

      const result = await service.releasePayment({
        escrowId,
        milestoneId,
        amount: 1000,
        reason: "test",
        releasedBy: "user-123",
      });

      expect(result.success).toBe(false);
      expect(result.blockers).toContain("escrow_blocked");
    });
  });

  describe("blockPayment", () => {
    it("should block payment successfully", async () => {
      const escrowId = "escrow-123";

      mockRepository.getEscrow.mockResolvedValue({
        id: escrowId,
        projectId: "project-123",
      } as any);
      mockRepository.updateEscrowStatus.mockResolvedValue({
        id: escrowId,
        status: "PENDING_SETTLEMENT",
      } as any);

      const result = await service.blockPayment(
        escrowId,
        "Fraud suspected",
        "admin-123",
      );

      expect(result.success).toBe(true);
      expect(result.escrowId).toBe(escrowId);
    });

    it("should throw error when escrow not found", async () => {
      mockRepository.getEscrow.mockResolvedValue(null);

      await expect(
        service.blockPayment("invalid", "test", "admin"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("calculatePaymentScore", () => {
    it("should calculate score with all factors", async () => {
      const escrowId = "escrow-123";
      const milestoneId = "milestone-123";

      mockRepository.getEscrow.mockResolvedValue({
        id: escrowId,
        projectId: "project-123",
        status: "ACTIVE",
      } as any);
      mockRepository.getMilestoneEvidence.mockResolvedValue([
        { id: "ev-1", validationStatus: "passed", validationScore: 0.95 },
        { id: "ev-2", validationStatus: "passed", validationScore: 0.90 },
      ] as any);
      mockRepository.countPendingChangeOrders.mockResolvedValue(0);

      const score = await service.calculatePaymentScore(escrowId, milestoneId);

      expect(score.overall).toBeGreaterThan(0.5);
      expect(["low", "medium", "high"]).toContain(score.riskLevel);
    });

    it("should return low score when escrow not found", async () => {
      mockRepository.getEscrow.mockResolvedValue(null);

      const score = await service.calculatePaymentScore(
        "invalid",
        "milestone-123",
      );

      expect(score.overall).toBeLessThan(0.4);
      expect(score.riskLevel).toBe("high");
    });
  });

  describe("getPaymentHistory", () => {
    it("should return escrow with transactions", async () => {
      const escrowId = "escrow-123";

      mockRepository.getEscrow.mockResolvedValue({
        id: escrowId,
        projectId: "project-123",
        transactions: [
          {
            id: "txn-1",
            type: "RELEASE",
            amount: 500,
            status: "COMPLETED",
          },
        ],
      } as any);

      const history = await service.getPaymentHistory(escrowId);

      expect(history).toBeDefined();
      expect(history?.id).toBe(escrowId);
    });
  });

  describe("getDiagnostics", () => {
    it("should return diagnostics", async () => {
      const tenantId = "tenant-123";

      mockDiagnostics.getDiagnostics.mockResolvedValue({
        analyzedAt: new Date().toISOString(),
        totalMilestones: 5,
        blockedCount: 1,
        readyCount: 2,
        releasedCount: 2,
        blockedMilestones: [],
      } as any);

      const diag = await service.getDiagnostics(tenantId);

      expect(diag.totalMilestones).toBe(5);
    });
  });
});
