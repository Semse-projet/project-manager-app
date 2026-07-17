import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

export type ProjectDraftSnapshot = {
  id: string;
  status: string;
  categoryId?: string | null;
  subcategoryId?: string | null;
  title?: string | null;
  description?: string | null;
  city?: string | null;
  locationType?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  urgency?: string | null;
  attachmentsExpected: boolean;
  publishedJobId?: string | null;
  completion: number;
};

export type DraftFields = Omit<ProjectDraftSnapshot, "id" | "completion" | "status" | "publishedJobId">;

@Injectable()
export class ProjectDraftService {
  constructor(private readonly prisma: PrismaService) {}

  computeCompletion(draft: DraftFields): number {
    let score = 0;
    if (draft.categoryId) score += 15;
    if (draft.subcategoryId) score += 15;
    if (draft.title && draft.title.length >= 5) score += 15;
    if (draft.description && draft.description.length >= 20) score += 20;
    if (draft.city) score += 20;
    if (draft.budgetMin != null && draft.budgetMax != null) score += 15;
    return Math.min(score, 100);
  }

  async createDraft(tenantId: string, orgId: string, userId: string): Promise<ProjectDraftSnapshot> {
    const draft = await this.prisma.projectDraft.create({
      data: { tenantId, orgId, createdBy: userId, flow: "publish_job", status: "in_progress", completion: 0 },
    });
    return this.toSnapshot(draft);
  }

  async updateDraft(id: string, tenantId: string, fields: DraftFields): Promise<ProjectDraftSnapshot> {
    const completion = this.computeCompletion(fields);
    const draft = await this.prisma.projectDraft.update({
      where: { id },
      data: { ...fields, completion, updatedAt: new Date() },
    });
    return this.toSnapshot(draft);
  }

  async confirmDraft(id: string, _tenantId: string): Promise<ProjectDraftSnapshot> {
    const draft = await this.prisma.projectDraft.update({
      where: { id },
      data: { status: "confirmed", updatedAt: new Date() },
    });
    return this.toSnapshot(draft);
  }

  async markPublished(id: string, tenantId: string, jobId: string): Promise<ProjectDraftSnapshot> {
    const draft = await this.prisma.projectDraft.update({
      where: { id },
      data: { status: "published", publishedJobId: jobId, updatedAt: new Date() },
    });
    return this.toSnapshot(draft);
  }

  async getDraft(id: string, tenantId: string): Promise<ProjectDraftSnapshot | null> {
    const draft = await this.prisma.projectDraft.findFirst({ where: { id, tenantId } });
    if (!draft) return null;
    return this.toSnapshot(draft);
  }

  private toSnapshot(draft: {
    id: string;
    status: string;
    categoryId?: string | null;
    subcategoryId?: string | null;
    title?: string | null;
    description?: string | null;
    city?: string | null;
    locationType?: string | null;
    budgetMin?: number | null;
    budgetMax?: number | null;
    urgency?: string | null;
    attachmentsExpected?: boolean | null;
    publishedJobId?: string | null;
    completion: number;
  }): ProjectDraftSnapshot {
    return {
      id: draft.id,
      status: draft.status,
      categoryId: draft.categoryId,
      subcategoryId: draft.subcategoryId,
      title: draft.title,
      description: draft.description,
      city: draft.city,
      locationType: draft.locationType,
      budgetMin: draft.budgetMin,
      budgetMax: draft.budgetMax,
      urgency: draft.urgency,
      attachmentsExpected: draft.attachmentsExpected ?? false,
      publishedJobId: draft.publishedJobId,
      completion: draft.completion,
    };
  }
}
