/**
 * KnowledgeCurator — inspired by Hermes's curator.py.
 *
 * Background service that archives stale AgentMemory and WorkspaceMemoryEntry
 * records. Runs on demand (called by BullMQ job or cron) — never blocks the
 * request path.
 *
 * Rules (mirrors Hermes defaults):
 *   AgentMemory:        archive after STALE_DAYS if importanceScore <= LOW_IMPORTANCE
 *   WorkspaceMemory:    archive after ARCHIVE_DAYS unconditionally
 *   "Archive" = delete from live tables + record count in CurationRun summary
 *
 * No auto-delete of high-importance memories — only low-signal noise is pruned.
 */
import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

const STALE_DAYS = 30;
const ARCHIVE_DAYS = 90;
const LOW_IMPORTANCE = 2;
const SKILL_STALE_DAYS = 30;   // mark skill "stale" if unused for 30 days
const SKILL_ARCHIVE_DAYS = 90; // archive stale skill after 90 days

export interface CurationRunSummary {
  ranAt: string;
  agentMemoriesArchived: number;
  workspaceMemoriesArchived: number;
  skillsMarkedStale: number;
  skillsArchived: number;
  durationMs: number;
  tenantId?: string;
}

@Injectable()
export class KnowledgeCuratorService {
  private readonly logger = new Logger(KnowledgeCuratorService.name);

  constructor(private readonly prisma: PrismaService) {}

  async runCuration(tenantId?: string): Promise<CurationRunSummary> {
    const start = Date.now();
    const staleThreshold = new Date(Date.now() - STALE_DAYS * 86_400_000);
    const archiveThreshold = new Date(Date.now() - ARCHIVE_DAYS * 86_400_000);
    const skillStaleThreshold = new Date(Date.now() - SKILL_STALE_DAYS * 86_400_000);
    const skillArchiveThreshold = new Date(Date.now() - SKILL_ARCHIVE_DAYS * 86_400_000);
    const tenantFilter = tenantId ? { tenantId } : {};

    const [agentResult, workspaceResult, skillsStale, skillsArchived] = await Promise.all([
      this.prisma.agentMemory.deleteMany({
        where: { updatedAt: { lt: staleThreshold }, importanceScore: { lte: LOW_IMPORTANCE }, ...tenantFilter },
      }),
      this.prisma.workspaceMemoryEntry.deleteMany({
        where: { updatedAt: { lt: archiveThreshold }, ...tenantFilter },
      }),
      // Mark active skills stale when unused > SKILL_STALE_DAYS (pinned skills are exempt)
      this.prisma.agentSkill.updateMany({
        where: { status: "active", lastUsedAt: { lt: skillStaleThreshold }, ...tenantFilter },
        data: { status: "stale" },
      }),
      // Archive skills that have been stale > SKILL_ARCHIVE_DAYS
      this.prisma.agentSkill.updateMany({
        where: { status: "stale", updatedAt: { lt: skillArchiveThreshold }, ...tenantFilter },
        data: { status: "archived" },
      }),
    ]);

    const summary: CurationRunSummary = {
      ranAt: new Date().toISOString(),
      agentMemoriesArchived: agentResult.count,
      workspaceMemoriesArchived: workspaceResult.count,
      skillsMarkedStale: skillsStale.count,
      skillsArchived: skillsArchived.count,
      durationMs: Date.now() - start,
      tenantId,
    };

    this.logger.log(
      `Curation complete: ${summary.agentMemoriesArchived} agent memories, ` +
      `${summary.workspaceMemoriesArchived} workspace memories, ` +
      `${summary.skillsMarkedStale} skills→stale, ${summary.skillsArchived} skills→archived ` +
      `in ${summary.durationMs}ms`,
    );

    return summary;
  }

  async getCurationStats(tenantId: string): Promise<{
    staleAgentMemories: number;
    staleWorkspaceMemories: number;
    activeSkills: number;
    staleSkills: number;
    archivedSkills: number;
  }> {
    const staleThreshold = new Date(Date.now() - STALE_DAYS * 86_400_000);
    const archiveThreshold = new Date(Date.now() - ARCHIVE_DAYS * 86_400_000);

    const [staleAgent, staleWorkspace, activeSkills, staleSkills, archivedSkills] = await Promise.all([
      this.prisma.agentMemory.count({
        where: { tenantId, updatedAt: { lt: staleThreshold }, importanceScore: { lte: LOW_IMPORTANCE } },
      }),
      this.prisma.workspaceMemoryEntry.count({
        where: { tenantId, updatedAt: { lt: archiveThreshold } },
      }),
      this.prisma.agentSkill.count({ where: { tenantId, status: "active" } }),
      this.prisma.agentSkill.count({ where: { tenantId, status: "stale" } }),
      this.prisma.agentSkill.count({ where: { tenantId, status: "archived" } }),
    ]);

    return { staleAgentMemories: staleAgent, staleWorkspaceMemories: staleWorkspace, activeSkills, staleSkills, archivedSkills };
  }
}
