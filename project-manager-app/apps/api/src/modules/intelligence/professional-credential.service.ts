import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { publicDisplayName } from "./public-sanitizer.js";

export type CredentialBadge =
  | "top_rated"
  | "zero_disputes"
  | "fast_deliverer"
  | "high_volume"
  | "verified"
  | "elite";

export type ProfessionalCredentialRecord = {
  id: string;
  tenantId: string;
  userId: string;
  orgId: string | null;
  displayName: string;
  completedProjects: number;
  activeProjects: number;
  totalManaged: number;
  onTimeRate: number;
  disputeRate: number;
  avgClientRating: number;
  trustScore: number;
  specialties: string[];
  badges: CredentialBadge[];
  verifiedAt: string | null;
  lastActivityAt: string | null;
  publicSlug: string | null;
  updatedAt: string;
};

function toNum(v: unknown): number {
  return parseFloat(String(v ?? 0)) || 0;
}

function buildBadges(cred: {
  avgClientRating: number;
  disputeRate: number;
  onTimeRate: number;
  completedProjects: number;
  trustScore: number;
}): CredentialBadge[] {
  const badges: CredentialBadge[] = [];
  if (cred.avgClientRating >= 4.5) badges.push("top_rated");
  if (cred.disputeRate === 0 && cred.completedProjects >= 3) badges.push("zero_disputes");
  if (cred.onTimeRate >= 0.9 && cred.completedProjects >= 5) badges.push("fast_deliverer");
  if (cred.completedProjects >= 10) badges.push("high_volume");
  if (cred.trustScore >= 80) badges.push("verified");
  if (cred.trustScore >= 90 && cred.avgClientRating >= 4.7 && cred.disputeRate === 0) badges.push("elite");
  return badges;
}

function inferSpecialties(jobCategories: string[]): string[] {
  const catMap: Record<string, string> = {
    electrical: "Electricidad", plumbing: "Plomería", hvac: "HVAC",
    construction: "Construcción", painting: "Pintura", carpentry: "Carpintería",
    tiling: "Pisos y Azulejos", roofing: "Techos", landscaping: "Jardinería",
    cleaning: "Limpieza", moving: "Mudanzas", general: "Servicios Generales",
  };
  return [...new Set(jobCategories.map(c => catMap[c.toLowerCase()] ?? c))].slice(0, 5);
}

function slugify(name: string, userId: string): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${userId.slice(-6)}`;
}

@Injectable()
export class ProfessionalCredentialService {
  private readonly logger = new Logger(ProfessionalCredentialService.name);

  constructor(private readonly prisma: PrismaService) {}

  async buildCredential(tenantId: string, userId: string): Promise<ProfessionalCredentialRecord> {
    // Step 1: get membership (needed for archive query)
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      select: { orgId: true, role: { select: { name: true } } },
      take: 1,
    });
    const orgId = memberships[0]?.orgId ?? null;

    // Step 2: parallel load of everything else
    const [user, ratings, allProjects, archives] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true, email: true,
          profile: { select: { displayName: true } },
        },
      }),
      this.prisma.rating.findMany({
        where: { toUserId: userId },
        select: { score: true },
      }),
      this.prisma.project.findMany({
        where: { tenantId, ...(orgId ? { assignedProOrgId: orgId } : {}) },
        select: {
          id: true, status: true, createdAt: true, updatedAt: true,
          job: { select: { category: true, budgetMax: true, budgetMin: true } },
        },
        take: 100,
      }),
      this.prisma.projectArchive.findMany({
        where: { tenantId, ...(orgId ? { contractorOrgId: orgId } : {}) },
        select: {
          durationDays: true, milestoneCount: true, totalValue: true,
          disputeCount: true, snapshotJson: true,
        },
        orderBy: { archivedAt: "desc" },
        take: 50,
      }),
    ]);

    if (!user) {
      throw new Error(`User '${userId}' not found`);
    }

    type PRow = { status: string; job: { category: string | null; budgetMax: unknown; budgetMin: unknown }; updatedAt: Date };
    type ARow = { durationDays: number | null; milestoneCount: number; totalValue: unknown; disputeCount: number; snapshotJson: unknown };
    type RRow = { score: number };

    const completedProjects = (allProjects as PRow[]).filter((p: PRow) => p.status === "CLOSED").length;
    const activeProjects = (allProjects as PRow[]).filter((p: PRow) => ["OPEN", "IN_PROGRESS"].includes(p.status)).length;

    const totalManaged = (archives as ARow[]).reduce((s: number, a: ARow) => s + toNum(a.totalValue), 0)
      + (allProjects as PRow[]).reduce((s: number, p: PRow) => s + toNum(p.job.budgetMax ?? p.job.budgetMin), 0) * 0.3;

    const avgClientRating = ratings.length > 0
      ? parseFloat(((ratings as RRow[]).reduce((s: number, r: RRow) => s + r.score, 0) / ratings.length).toFixed(2))
      : 0;

    const archivesWithMilestones = (archives as ARow[]).filter((a: ARow) => a.milestoneCount > 0);
    const onTimeRate = archivesWithMilestones.length > 0
      ? archivesWithMilestones.reduce((s: number, a: ARow) => {
          const snap = a.snapshotJson as Record<string, unknown>;
          const stats = snap.stats as Record<string, unknown> | undefined;
          const onTime = toNum(stats?.onTimeMilestones) / Math.max(1, toNum(a.milestoneCount));
          return s + onTime;
        }, 0) / archivesWithMilestones.length
      : 0.8;

    const disputeRate = completedProjects > 0
      ? (archives as ARow[]).filter((a: ARow) => a.disputeCount > 0).length / Math.max(1, completedProjects)
      : 0;

    // Simple trust score computation
    const trustScore = Math.min(100, Math.round(
      avgClientRating * 12 +
      (1 - disputeRate) * 20 +
      Math.min(30, completedProjects * 3) +
      onTimeRate * 20 +
      (totalManaged > 100000 ? 10 : totalManaged > 50000 ? 5 : 0)
    ));

    const specialties = inferSpecialties((allProjects as PRow[]).map((p: PRow) => p.job.category ?? "general").filter(Boolean));
    const badges = buildBadges({ avgClientRating, disputeRate, onTimeRate, completedProjects, trustScore });
    // Nunca usar el email como nombre público: aparece en la landing, en
    // /pro/[slug] y en el propio slug de la URL. publicDisplayName también
    // descarta displayNames que sean un email o un teléfono.
    const displayNameRaw = publicDisplayName(user.profile?.displayName, "Profesional SEMSE");
    const slug = slugify(displayNameRaw, userId);

    const data = {
      tenantId, userId, orgId,
      displayName: displayNameRaw,
      completedProjects, activeProjects,
      totalManaged,
      onTimeRate: parseFloat(onTimeRate.toFixed(4)),
      disputeRate: parseFloat(disputeRate.toFixed(4)),
      avgClientRating,
      trustScore,
      specialties,
      badgesJson: badges,
      publicSlug: slug,
      verifiedAt: completedProjects >= 3 ? new Date() : null,
      lastActivityAt: (allProjects as PRow[])[0]?.updatedAt ?? null,
    };

    const credential = await this.prisma.professionalCredential.upsert({
      where: { userId },
      create: data,
      update: data,
    });

    this.logger.log(`[cred] built userId=${userId} trust=${trustScore} projects=${completedProjects} badges=${badges.join(",")}`);
    return this.toRecord(credential as Record<string, unknown>);
  }

  async getCredentialByUserId(userId: string, tenantId: string): Promise<ProfessionalCredentialRecord | null> {
    const row = await this.prisma.professionalCredential.findFirst({ where: { userId, tenantId } });
    return row ? this.toRecord(row as Record<string, unknown>) : null;
  }

  async getCredentialBySlug(slug: string): Promise<ProfessionalCredentialRecord | null> {
    const row = await this.prisma.professionalCredential.findUnique({ where: { publicSlug: slug } });
    return row ? this.toRecord(row as Record<string, unknown>) : null;
  }

  async listTopProfessionals(tenantId: string, limit = 20): Promise<ProfessionalCredentialRecord[]> {
    const rows = await this.prisma.professionalCredential.findMany({
      where: { tenantId },
      orderBy: [{ trustScore: "desc" }, { completedProjects: "desc" }],
      take: limit,
    });
    return rows.map((r: Record<string, unknown>) => this.toRecord(r));
  }

  private toRecord(row: Record<string, unknown>): ProfessionalCredentialRecord {
    return {
      id: String(row.id),
      tenantId: String(row.tenantId),
      userId: String(row.userId),
      orgId: row.orgId ? String(row.orgId) : null,
      displayName: String(row.displayName),
      completedProjects: Number(row.completedProjects ?? 0),
      activeProjects: Number(row.activeProjects ?? 0),
      totalManaged: toNum(row.totalManaged),
      onTimeRate: toNum(row.onTimeRate),
      disputeRate: toNum(row.disputeRate),
      avgClientRating: toNum(row.avgClientRating),
      trustScore: Number(row.trustScore ?? 0),
      specialties: Array.isArray(row.specialties) ? row.specialties as string[] : [],
      badges: Array.isArray(row.badgesJson) ? row.badgesJson as CredentialBadge[] : [],
      verifiedAt: row.verifiedAt ? new Date(String(row.verifiedAt)).toISOString() : null,
      lastActivityAt: row.lastActivityAt ? new Date(String(row.lastActivityAt)).toISOString() : null,
      publicSlug: row.publicSlug ? String(row.publicSlug) : null,
      updatedAt: new Date(String(row.updatedAt)).toISOString(),
    };
  }
}
