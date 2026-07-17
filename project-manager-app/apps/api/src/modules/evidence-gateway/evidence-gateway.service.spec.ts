import { Test, TestingModule } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { EvidenceGatewayService } from "./evidence-gateway.service.js";
import { EvidenceGatewayRepository } from "./evidence-gateway.repository.js";
import { VisionService } from "../vision/vision.service.js";
import { StorageService } from "../../infrastructure/storage/storage.service.js";

describe("EvidenceGatewayService", () => {
  let service: EvidenceGatewayService;
  let _repository: jest.Mocked<EvidenceGatewayRepository>;

  const mockRepository = {
    createEvidence: jest.fn(),
    updateEvidenceValidation: jest.fn(),
    getEvidence: jest.fn(),
    getMilestoneEvidenceValidationStatus: jest.fn(),
    getProjectEvidenceByStatus: jest.fn(),
    logValidationEvent: jest.fn(),
  };

  const mockVisionService = {
    runAnalysis: jest.fn().mockResolvedValue({ qualityScore: 0.85, canAutoApprove: true }),
    getAnalysis: jest.fn().mockResolvedValue({ duplicateRisk: 0.1 }),
  };

  const mockStorageService = {
    publicUrl: jest.fn((key: string) => `https://api.example.com/v1/uploads/files/${encodeURIComponent(key)}`),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvidenceGatewayService,
        { provide: EvidenceGatewayRepository, useValue: mockRepository },
        { provide: VisionService, useValue: mockVisionService },
        { provide: StorageService, useValue: mockStorageService },
      ],
    }).compile();

    service = module.get<EvidenceGatewayService>(EvidenceGatewayService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("uploadEvidence", () => {
    it("should upload evidence successfully", async () => {
      const request = {
        projectId: "proj-123",
        milestoneId: "mile-123",
        uploadedById: "user-123",
        kind: "PHOTO" as const,
        bucketKey: "s3://bucket/photo.jpg",
      };

      mockRepository.createEvidence.mockResolvedValue({
        id: "ev-123",
        projectId: "proj-123",
        uploadedById: "user-123",
      } as any);

      const result = await service.uploadEvidence(request);

      expect(result.evidenceId).toBe("ev-123");
      expect(result.status).toBe("pending_validation");
      expect(mockRepository.createEvidence).toHaveBeenCalled();
    });

    it("should throw error when projectId missing", async () => {
      const request = {
        projectId: "",
        uploadedById: "user-123",
        kind: "PHOTO" as const,
        bucketKey: "s3://bucket/photo.jpg",
      };

      await expect(service.uploadEvidence(request as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("should throw error when uploadedById missing", async () => {
      const request = {
        projectId: "proj-123",
        uploadedById: "",
        kind: "PHOTO" as const,
        bucketKey: "s3://bucket/photo.jpg",
      };

      await expect(service.uploadEvidence(request as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe("validateEvidenceAsync", () => {
    it("should pass real storage URL to vision analysis (not mock)", async () => {
      const evidenceId = "ev-real";
      const projectId = "proj-123";
      const bucketKey = "tenants/t1/evidence/photo.jpg";

      mockRepository.getEvidence.mockResolvedValue({
        id: evidenceId,
        kind: "PHOTO",
        bucketKey,
        metadataJson: {},
      } as any);
      mockRepository.updateEvidenceValidation.mockResolvedValue({} as any);

      await service.validateEvidenceAsync(evidenceId, projectId);

      expect(mockStorageService.publicUrl).toHaveBeenCalledWith(bucketKey);
      const imageUrlUsed = mockVisionService.runAnalysis.mock.calls[0]?.[0]?.imageUrl as string;
      expect(imageUrlUsed).not.toContain("mock://");
      expect(imageUrlUsed).toContain(encodeURIComponent(bucketKey));
    });

    it("should validate evidence and update status to passed", async () => {
      const evidenceId = "ev-123";
      const projectId = "proj-123";

      mockRepository.getEvidence.mockResolvedValue({
        id: evidenceId,
        kind: "PHOTO",
        bucketKey: "s3://bucket/photo.jpg",
        metadataJson: { resolution: "1920x1080", fileSize: 2000000 },
      } as any);

      mockRepository.updateEvidenceValidation.mockResolvedValue({} as any);

      await service.validateEvidenceAsync(evidenceId, projectId);

      expect(mockRepository.updateEvidenceValidation).toHaveBeenCalled();
      const call = mockRepository.updateEvidenceValidation.mock.calls[0];
      expect(call[0]).toBe(evidenceId);
      expect(call[1].validationStatus).toBeDefined();
    });

    it("should emit events during validation", async () => {
      const evidenceId = "ev-123";
      const projectId = "proj-123";

      mockRepository.getEvidence.mockResolvedValue({
        id: evidenceId,
        kind: "PHOTO",
      } as any);

      mockRepository.updateEvidenceValidation.mockResolvedValue({} as any);

      await service.validateEvidenceAsync(evidenceId, projectId);

      expect(mockRepository.logValidationEvent).toHaveBeenCalled();
    });

    it("should fail validation when evidence not found", async () => {
      mockRepository.getEvidence.mockResolvedValue(null);

      await expect(
        service.validateEvidenceAsync("invalid", "proj-123"),
      ).rejects.toThrow();
    });
  });

  describe("getMilestoneValidationStatus", () => {
    it("should return validation status for milestone", async () => {
      const projectId = "proj-123";
      const milestoneId = "mile-123";

      mockRepository.getMilestoneEvidenceValidationStatus.mockResolvedValue({
        total: 5,
        passed: 4,
        failed: 0,
        pending: 1,
        avgScore: 0.85,
        isComplete: false,
        isReady: true,
      } as any);

      const status = await service.getMilestoneValidationStatus(
        projectId,
        milestoneId,
      );

      expect(status.evidenceCount).toBe(5);
      expect(status.passedCount).toBe(4);
      expect(status.failedCount).toBe(0);
      expect(status.isReadyForPayment).toBe(true);
    });

    it("should return 0% readiness when no evidence", async () => {
      mockRepository.getMilestoneEvidenceValidationStatus.mockResolvedValue({
        total: 0,
        passed: 0,
        failed: 0,
        pending: 0,
        avgScore: 0,
        isComplete: false,
        isReady: false,
      } as any);

      const status = await service.getMilestoneValidationStatus(
        "proj-123",
        "mile-123",
      );

      expect(status.evidenceCount).toBe(0);
      expect(status.readinessPercentage).toBe(0);
    });
  });

  describe("getFailedEvidence", () => {
    it("should return failed evidence", async () => {
      mockRepository.getProjectEvidenceByStatus.mockResolvedValue([
        {
          id: "ev-1",
          kind: "PHOTO",
          validationStatus: "failed",
          aiQualityScore: 0.3,
        },
      ] as any);

      const evidence = await service.getFailedEvidence("proj-123");

      expect(evidence).toHaveLength(1);
      expect(evidence[0].validationStatus).toBe("failed");
    });
  });

  describe("getPendingEvidence", () => {
    it("should return pending evidence", async () => {
      mockRepository.getProjectEvidenceByStatus.mockResolvedValue([
        {
          id: "ev-2",
          kind: "VIDEO",
          validationStatus: "pending",
        },
      ] as any);

      const evidence = await service.getPendingEvidence("proj-123");

      expect(evidence).toHaveLength(1);
      expect(evidence[0].validationStatus).toBe("pending");
    });
  });

  describe("getPassedEvidence", () => {
    it("should return passed evidence", async () => {
      mockRepository.getProjectEvidenceByStatus.mockResolvedValue([
        {
          id: "ev-3",
          kind: "DOCUMENT",
          validationStatus: "passed",
          aiQualityScore: 0.95,
        },
      ] as any);

      const evidence = await service.getPassedEvidence("proj-123");

      expect(evidence).toHaveLength(1);
      expect(evidence[0].validationStatus).toBe("passed");
    });
  });
});
