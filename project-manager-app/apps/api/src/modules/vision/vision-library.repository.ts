import { Injectable } from "@nestjs/common";
import { normalizeLibraryText } from "@semse/schemas";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";

// Sense Vision — persistence for Construction Library, Mi Diccionario and
// VisionCorrection. Spec: docs/specs/vision/sense-vision-field-library.spec.md §7.
// Dictionary/correction queries are always scoped by the authenticated
// userId + tenantId passed in by the service — never by ids from a body.
@Injectable()
export class VisionLibraryRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ── Construction Library ─────────────────────────────────────────────

  listActiveLibraryItems() {
    return this.prisma.constructionLibraryItem.findMany({ where: { active: true }, orderBy: { nameEn: "asc" } });
  }

  searchLibraryItems(input: { q?: string; category?: string; trade?: string; take: number }) {
    const q = input.q ? normalizeLibraryText(input.q) : "";
    return this.prisma.constructionLibraryItem.findMany({
      where: {
        active: true,
        ...(q ? { searchText: { contains: q } } : {}),
        ...(input.category ? { category: input.category } : {}),
        ...(input.trade ? { trades: { has: input.trade } } : {}),
      },
      orderBy: { nameEn: "asc" },
      take: input.take,
    });
  }

  findLibraryItemByIdOrSlug(idOrSlug: string) {
    return this.prisma.constructionLibraryItem.findFirst({
      where: { active: true, OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    });
  }

  findLibraryItemById(id: string) {
    return this.prisma.constructionLibraryItem.findUnique({ where: { id } });
  }

  // ── Mi Diccionario ───────────────────────────────────────────────────

  listDictionary(input: { tenantId: string; userId: string; favorite?: boolean; learned?: boolean; q?: string; take: number }) {
    const q = input.q ? normalizeLibraryText(input.q) : "";
    return this.prisma.userDictionaryItem.findMany({
      where: {
        tenantId: input.tenantId,
        userId: input.userId,
        ...(input.favorite === undefined ? {} : { favorite: input.favorite }),
        ...(input.learned === undefined ? {} : { learned: input.learned }),
        ...(q ? { libraryItem: { searchText: { contains: q } } } : {}),
      },
      include: { libraryItem: true },
      orderBy: { lastSeenAt: "desc" },
      take: input.take,
    });
  }

  async dictionaryStats(input: { tenantId: string; userId: string; since: Date }) {
    const where = { tenantId: input.tenantId, userId: input.userId };
    const [total, learned, favorites, addedThisWeek] = await Promise.all([
      this.prisma.userDictionaryItem.count({ where }),
      this.prisma.userDictionaryItem.count({ where: { ...where, learned: true } }),
      this.prisma.userDictionaryItem.count({ where: { ...where, favorite: true } }),
      this.prisma.userDictionaryItem.count({ where: { ...where, firstSeenAt: { gte: input.since } } }),
    ]);
    return { total, learned, favorites, addedThisWeek };
  }

  findDictionaryEntry(input: { userId: string; libraryItemId: string }) {
    return this.prisma.userDictionaryItem.findUnique({
      where: { userId_libraryItemId: { userId: input.userId, libraryItemId: input.libraryItemId } },
      include: { libraryItem: true },
    });
  }

  /** Idempotent save: a second save of the same word never duplicates (P11). */
  upsertDictionaryEntry(input: { tenantId: string; userId: string; libraryItemId: string; fromScan: boolean }) {
    const now = new Date();
    return this.prisma.userDictionaryItem.upsert({
      where: { userId_libraryItemId: { userId: input.userId, libraryItemId: input.libraryItemId } },
      create: {
        tenantId: input.tenantId,
        userId: input.userId,
        libraryItemId: input.libraryItemId,
        firstSeenAt: now,
        lastSeenAt: now,
        timesScanned: input.fromScan ? 1 : 0,
      },
      update: {
        lastSeenAt: now,
        ...(input.fromScan ? { timesScanned: { increment: 1 } } : {}),
      },
      include: { libraryItem: true },
    });
  }

  updateDictionaryEntry(
    id: string,
    data: { favorite?: boolean; learned?: boolean; notes?: string | null; viewed?: boolean },
  ) {
    return this.prisma.userDictionaryItem.update({
      where: { id },
      data: {
        ...(data.favorite === undefined ? {} : { favorite: data.favorite }),
        ...(data.learned === undefined ? {} : { learned: data.learned }),
        ...(data.notes === undefined ? {} : { notes: data.notes }),
        ...(data.viewed ? { timesViewed: { increment: 1 }, lastSeenAt: new Date() } : {}),
      },
      include: { libraryItem: true },
    });
  }

  /** Removes only the user's row; the global library item is untouched (P12). */
  async deleteDictionaryEntry(input: { tenantId: string; userId: string; libraryItemId: string }) {
    const result = await this.prisma.userDictionaryItem.deleteMany({
      where: { tenantId: input.tenantId, userId: input.userId, libraryItemId: input.libraryItemId },
    });
    return result.count > 0;
  }

  // ── Corrections ──────────────────────────────────────────────────────

  createCorrection(input: {
    tenantId: string;
    userId: string;
    predictedLibraryItemId: string | null;
    selectedLibraryItemId: string | null;
    predictedConfidence: number | null;
    source: string;
  }) {
    return this.prisma.visionCorrection.create({ data: input });
  }
}
