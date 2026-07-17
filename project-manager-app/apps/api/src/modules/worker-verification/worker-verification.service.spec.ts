import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { WorkerVerificationService } from "./worker-verification.service.js";
import { WorkerVerificationRepository } from "./worker-verification.repository.js";

describe("WorkerVerificationService", () => {
  let service: WorkerVerificationService;
  let _repository: jest.Mocked<WorkerVerificationRepository>;

  const mockRepository = {
    getWorker: jest.fn(),
    updateWorkerVerificationStatus: jest.fn(),
    createVerificationLog: jest.fn(),
    getVerificationHistory: jest.fn(),
    storeDidSignature: jest.fn(),
    verifyDidSignature: jest.fn(),
    getUnverifiedWorkers: jest.fn(),
    countVerifiedWorkers: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkerVerificationService,
        { provide: WorkerVerificationRepository, useValue: mockRepository },
      ],
    }).compile();

    service = module.get<WorkerVerificationService>(
      WorkerVerificationService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("initiateVerification", () => {
    it("should initiate verification for a worker", async () => {
      const workerId = "worker-123";
      const tenantId = "tenant-123";

      mockRepository.getWorker.mockResolvedValue({
        id: workerId,
        name: "John Doe",
      } as any);

      const state = await service.initiateVerification({
        workerId,
        tenantId,
        verificationType: "DID_SIGNATURE",
      });

      expect(state.workerId).toBe(workerId);
      expect(state.status).toBe("pending");
    });

    it("should throw error when worker not found", async () => {
      mockRepository.getWorker.mockResolvedValue(null);

      await expect(
        service.initiateVerification({
          workerId: "invalid",
          tenantId: "tenant-123",
          verificationType: "DID_SIGNATURE",
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("submitDidSignature", () => {
    it("should verify and update worker status when signature is valid", async () => {
      const workerId = "worker-123";
      const tenantId = "tenant-123";
      const signature = "valid-signature";
      const publicKey = "valid-public-key";

      mockRepository.storeDidSignature.mockResolvedValue({} as any);
      mockRepository.verifyDidSignature.mockResolvedValue(true);
      mockRepository.updateWorkerVerificationStatus.mockResolvedValue({} as any);

      const state = await service.submitDidSignature(
        workerId,
        tenantId,
        signature,
        publicKey,
      );

      expect(state.status).toBe("verified");
      expect(state.verifiedAt).toBeDefined();
    });

    it("should fail verification when signature is invalid", async () => {
      const workerId = "worker-123";
      const tenantId = "tenant-123";

      mockRepository.storeDidSignature.mockResolvedValue({} as any);
      mockRepository.verifyDidSignature.mockResolvedValue(false);

      const state = await service.submitDidSignature(
        workerId,
        tenantId,
        "invalid-signature",
        "invalid-key",
      );

      expect(state.status).toBe("failed");
      expect(state.feedback).toContain("verification failed");
    });
  });

  describe("getVerificationStatus", () => {
    it("should return verification state", async () => {
      const workerId = "worker-123";

      const state = await service.getVerificationStatus(workerId);

      expect(state.workerId).toBe(workerId);
      expect(state.status).toBeDefined();
    });
  });

  describe("getVerificationHistory", () => {
    it("should return verification history", async () => {
      const workerId = "worker-123";

      mockRepository.getVerificationHistory.mockResolvedValue({
        workerId,
        verifications: [
          {
            type: "DID_SIGNATURE",
            status: "verified",
            verifiedAt: new Date(),
          },
        ],
        overallStatus: "verified",
      } as any);

      const history = await service.getVerificationHistory(workerId);

      expect(history.workerId).toBe(workerId);
      expect(history.verifications).toHaveLength(1);
    });
  });

  describe("listUnverifiedWorkers", () => {
    it("should return list of unverified workers", async () => {
      const tenantId = "tenant-123";

      mockRepository.getUnverifiedWorkers.mockResolvedValue([
        { id: "w1", name: "Worker 1", verificationStatus: "pending" },
        { id: "w2", name: "Worker 2", verificationStatus: "pending" },
      ] as any);

      const workers = await service.listUnverifiedWorkers(tenantId);

      expect(workers).toHaveLength(2);
      expect(workers[0].verificationStatus).toBe("pending");
    });
  });

  describe("getVerificationStats", () => {
    it("should return verification statistics", async () => {
      const tenantId = "tenant-123";

      mockRepository.countVerifiedWorkers.mockResolvedValue(8);
      mockRepository.getUnverifiedWorkers.mockResolvedValue([
        { id: "w1" },
        { id: "w2" },
      ] as any);

      const stats = await service.getVerificationStats(tenantId);

      expect(stats.tenantId).toBe(tenantId);
      expect(stats.totalWorkers).toBe(10);
      expect(stats.verifiedCount).toBe(8);
      expect(stats.unverifiedCount).toBe(2);
      expect(stats.verificationRate).toBe(80);
    });

    it("should handle zero workers", async () => {
      const tenantId = "tenant-123";

      mockRepository.countVerifiedWorkers.mockResolvedValue(0);
      mockRepository.getUnverifiedWorkers.mockResolvedValue([] as any);

      const stats = await service.getVerificationStats(tenantId);

      expect(stats.totalWorkers).toBe(0);
      expect(stats.verificationRate).toBe(0);
    });
  });
});
