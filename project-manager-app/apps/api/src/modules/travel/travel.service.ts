import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { databaseEnabled } from "../../infrastructure/persistence/persistence-mode.js";

// ── Record types ──────────────────────────────────────────────────────────────

export interface TravelAssignmentRecord {
  id: string;
  tenantId: string;
  jobId: string;
  assignedTo: string;
  destinationCity: string;
  departureDate: string;
  returnDate: string | null;
  estimatedDays: number | null;
  requiresLodging: boolean;
  headcount: number;
  mainTransportMode: string | null;
  approvedBudget: number | null;
  approvedBy: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TravelExpenseRecord {
  id: string;
  tenantId: string;
  travelId: string;
  submittedBy: string;
  category: string;
  subcategory: string | null;
  description: string | null;
  amount: number;
  currency: string;
  expenseDate: string;
  city: string | null;
  origin: string | null;
  destination: string | null;
  vendor: string | null;
  odometer: number | null;
  gallons: number | null;
  receiptUrl: string | null;
  status: string;
  approvedBy: string | null;
  approvedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LodgingBookingRecord {
  id: string;
  tenantId: string;
  travelId: string;
  type: string;
  name: string;
  address: string | null;
  placeId: string | null;
  googleMapsUri: string | null;
  latitude: number | null;
  longitude: number | null;
  checkIn: string;
  checkOut: string;
  costPerNight: number | null;
  estimatedTotal: number | null;
  actualTotal: number | null;
  confirmationCode: string | null;
  paidBy: string | null;
  status: string;
  receiptUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TravelAdvanceRecord {
  id: string;
  tenantId: string;
  travelId: string;
  issuedTo: string;
  amount: number;
  currency: string;
  method: string | null;
  issuedAt: string;
  approvedBy: string | null;
  purpose: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface TravelSettlementRecord {
  id: string;
  tenantId: string;
  travelId: string;
  approvedBudget: number | null;
  totalAdvances: number;
  totalLodging: number;
  totalMeals: number;
  totalTransport: number;
  totalOther: number;
  totalSpent: number;
  balanceDue: number;
  status: string;
  notes: string | null;
  closedBy: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Converters ────────────────────────────────────────────────────────────────

function d(v: Prisma.Decimal | null | undefined): number | null {
  return v == null ? null : Number(v);
}

function toAssignment(row: {
  id: string; tenantId: string; jobId: string; assignedTo: string;
  destinationCity: string; departureDate: Date; returnDate: Date | null;
  estimatedDays: number | null; requiresLodging: boolean; headcount: number;
  mainTransportMode: string | null; approvedBudget: Prisma.Decimal | null;
  approvedBy: string | null; status: string; notes: string | null;
  createdAt: Date; updatedAt: Date;
}): TravelAssignmentRecord {
  return {
    id: row.id, tenantId: row.tenantId, jobId: row.jobId, assignedTo: row.assignedTo,
    destinationCity: row.destinationCity,
    departureDate: row.departureDate.toISOString(),
    returnDate: row.returnDate?.toISOString() ?? null,
    estimatedDays: row.estimatedDays, requiresLodging: row.requiresLodging,
    headcount: row.headcount, mainTransportMode: row.mainTransportMode,
    approvedBudget: d(row.approvedBudget), approvedBy: row.approvedBy,
    status: row.status, notes: row.notes,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  };
}

function toExpense(row: {
  id: string; tenantId: string; travelId: string; submittedBy: string;
  category: string; subcategory: string | null; description: string | null;
  amount: Prisma.Decimal; currency: string; expenseDate: Date; city: string | null;
  origin: string | null; destination: string | null; vendor: string | null;
  odometer: Prisma.Decimal | null; gallons: Prisma.Decimal | null; receiptUrl: string | null;
  status: string; approvedBy: string | null; approvedAt: Date | null;
  notes: string | null; createdAt: Date; updatedAt: Date;
}): TravelExpenseRecord {
  return {
    id: row.id, tenantId: row.tenantId, travelId: row.travelId,
    submittedBy: row.submittedBy, category: row.category,
    subcategory: row.subcategory, description: row.description,
    amount: Number(row.amount), currency: row.currency,
    expenseDate: row.expenseDate.toISOString(),
    city: row.city, origin: row.origin, destination: row.destination,
    vendor: row.vendor, odometer: d(row.odometer), gallons: d(row.gallons),
    receiptUrl: row.receiptUrl, status: row.status,
    approvedBy: row.approvedBy, approvedAt: row.approvedAt?.toISOString() ?? null,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  };
}

function toLodging(row: {
  id: string; tenantId: string; travelId: string; type: string; name: string;
  address: string | null; placeId: string | null; googleMapsUri: string | null;
  latitude: Prisma.Decimal | null; longitude: Prisma.Decimal | null; checkIn: Date; checkOut: Date;
  costPerNight: Prisma.Decimal | null; estimatedTotal: Prisma.Decimal | null;
  actualTotal: Prisma.Decimal | null; confirmationCode: string | null;
  paidBy: string | null; status: string; receiptUrl: string | null;
  notes: string | null; createdAt: Date; updatedAt: Date;
}): LodgingBookingRecord {
  return {
    id: row.id, tenantId: row.tenantId, travelId: row.travelId,
    type: row.type, name: row.name, address: row.address,
    placeId: row.placeId, googleMapsUri: row.googleMapsUri,
    latitude: d(row.latitude), longitude: d(row.longitude),
    checkIn: row.checkIn.toISOString(), checkOut: row.checkOut.toISOString(),
    costPerNight: d(row.costPerNight), estimatedTotal: d(row.estimatedTotal),
    actualTotal: d(row.actualTotal), confirmationCode: row.confirmationCode,
    paidBy: row.paidBy, status: row.status, receiptUrl: row.receiptUrl,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  };
}

function toAdvance(row: {
  id: string; tenantId: string; travelId: string; issuedTo: string;
  amount: Prisma.Decimal; currency: string; method: string | null; issuedAt: Date;
  approvedBy: string | null; purpose: string | null; status: string;
  createdAt: Date; updatedAt: Date;
}): TravelAdvanceRecord {
  return {
    id: row.id, tenantId: row.tenantId, travelId: row.travelId,
    issuedTo: row.issuedTo, amount: Number(row.amount), currency: row.currency,
    method: row.method, issuedAt: row.issuedAt.toISOString(),
    approvedBy: row.approvedBy, purpose: row.purpose, status: row.status,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  };
}

function toSettlement(row: {
  id: string; tenantId: string; travelId: string; approvedBudget: Prisma.Decimal | null;
  totalAdvances: Prisma.Decimal; totalLodging: Prisma.Decimal; totalMeals: Prisma.Decimal;
  totalTransport: Prisma.Decimal; totalOther: Prisma.Decimal; totalSpent: Prisma.Decimal;
  balanceDue: Prisma.Decimal; status: string; notes: string | null;
  closedBy: string | null; closedAt: Date | null; createdAt: Date; updatedAt: Date;
}): TravelSettlementRecord {
  return {
    id: row.id, tenantId: row.tenantId, travelId: row.travelId,
    approvedBudget: d(row.approvedBudget),
    totalAdvances: Number(row.totalAdvances), totalLodging: Number(row.totalLodging),
    totalMeals: Number(row.totalMeals), totalTransport: Number(row.totalTransport),
    totalOther: Number(row.totalOther), totalSpent: Number(row.totalSpent),
    balanceDue: Number(row.balanceDue), status: row.status, notes: row.notes,
    closedBy: row.closedBy, closedAt: row.closedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  };
}

// ── Mock stores ───────────────────────────────────────────────────────────────

const MOCK_ASSIGNMENTS: TravelAssignmentRecord[] = [];
const MOCK_EXPENSES: TravelExpenseRecord[] = [];
const MOCK_LODGINGS: LodgingBookingRecord[] = [];
const MOCK_ADVANCES: TravelAdvanceRecord[] = [];
const MOCK_SETTLEMENTS: TravelSettlementRecord[] = [];

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class TravelService {
  constructor(private readonly prisma: PrismaService) {}

  // ── TravelAssignment ───────────────────────────────────────────────────────

  async listAssignments(input: {
    tenantId: string;
    userId: string;
    roles: string[];
    status?: string;
    jobId?: string;
    assignedTo?: string;
    scope?: string;
  }): Promise<TravelAssignmentRecord[]> {
    const adminScope = input.scope === "all" && input.roles.includes("OPS_ADMIN");
    const assignedToFilter = adminScope ? input.assignedTo : input.userId;

    if (!databaseEnabled()) return MOCK_ASSIGNMENTS.filter(a =>
      a.tenantId === input.tenantId &&
      (!assignedToFilter || a.assignedTo === assignedToFilter) &&
      (!input.status || a.status === input.status) &&
      (!input.jobId || a.jobId === input.jobId)
    );
    const rows = await this.prisma.travelAssignment.findMany({
      where: {
        tenantId: input.tenantId,
        ...(assignedToFilter ? { assignedTo: assignedToFilter } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.jobId ? { jobId: input.jobId } : {}),
      },
      orderBy: { departureDate: "desc" },
    });
    return rows.map(toAssignment);
  }

  /**
   * Fetches a travel assignment scoped by tenant AND verifies the caller is
   * either the assigned worker, OPS_ADMIN, or the client org that owns the
   * underlying job — not just "anyone in the same tenant with jobs:read".
   * Every method below that operates on a specific travelId calls this first.
   */
  async getAssignment(input: {
    tenantId: string; travelId: string; actorUserId: string; orgId: string; roles: string[];
  }): Promise<TravelAssignmentRecord> {
    if (!databaseEnabled()) {
      const a = MOCK_ASSIGNMENTS.find(x => x.id === input.travelId);
      if (!a) throw new NotFoundException("Travel assignment not found");
      await this.assertTravelAccess(a, input);
      return a;
    }
    const row = await this.prisma.travelAssignment.findFirst({
      where: { id: input.travelId, tenantId: input.tenantId },
    });
    if (!row) throw new NotFoundException("Travel assignment not found");
    const assignment = toAssignment(row);
    await this.assertTravelAccess(assignment, input);
    return assignment;
  }

  private async assertTravelAccess(
    assignment: TravelAssignmentRecord,
    actor: { actorUserId: string; orgId: string; roles: string[] },
  ): Promise<void> {
    if (actor.roles.includes("OPS_ADMIN")) return;
    if (assignment.assignedTo === actor.actorUserId) return;

    if (!databaseEnabled()) {
      // No job/org lookup available in mock mode — worker/admin checks above are all we can do.
      throw new ForbiddenException("actor is not assigned to this travel");
    }

    const job = await this.prisma.job.findFirst({
      where: { id: assignment.jobId, tenantId: assignment.tenantId },
      select: { clientOrgId: true },
    });
    if (job && actor.orgId === job.clientOrgId) return;

    throw new ForbiddenException("actor is not assigned to this travel");
  }

  async createAssignment(input: {
    tenantId: string; jobId: string; assignedTo: string;
    destinationCity: string; departureDate: string; returnDate?: string;
    estimatedDays?: number; requiresLodging?: boolean; headcount?: number;
    mainTransportMode?: string; approvedBudget?: number; approvedBy?: string;
    notes?: string;
  }): Promise<TravelAssignmentRecord> {
    if (!input.destinationCity?.trim()) throw new BadRequestException("destinationCity required");
    if (!input.departureDate) throw new BadRequestException("departureDate required");

    if (!databaseEnabled()) {
      const rec: TravelAssignmentRecord = {
        id: `trv_${Date.now()}`, tenantId: input.tenantId, jobId: input.jobId,
        assignedTo: input.assignedTo, destinationCity: input.destinationCity,
        departureDate: new Date(input.departureDate).toISOString(),
        returnDate: input.returnDate ? new Date(input.returnDate).toISOString() : null,
        estimatedDays: input.estimatedDays ?? null,
        requiresLodging: input.requiresLodging ?? true,
        headcount: input.headcount ?? 1,
        mainTransportMode: input.mainTransportMode ?? null,
        approvedBudget: input.approvedBudget ?? null,
        approvedBy: input.approvedBy ?? null,
        status: "DRAFT", notes: input.notes ?? null,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      MOCK_ASSIGNMENTS.push(rec);
      return rec;
    }

    // 2.35 — updateMany matching zero rows used to fail silently and fall
    // through to creating the TravelAssignment anyway, letting CLIENT/OPS_ADMIN
    // point a travel assignment at a job belonging to another tenant or at a
    // nonexistent jobId. Block on zero rows affected instead.
    const jobUpdate = await this.prisma.job.updateMany({
      where: { id: input.jobId, tenantId: input.tenantId },
      data: { isOutOfTown: true, destinationCity: input.destinationCity },
    });
    if (jobUpdate.count === 0) {
      throw new NotFoundException(`Job '${input.jobId}' not found for this tenant`);
    }
    const row = await this.prisma.travelAssignment.create({
      data: {
        tenantId: input.tenantId, jobId: input.jobId, assignedTo: input.assignedTo,
        destinationCity: input.destinationCity,
        departureDate: new Date(input.departureDate),
        returnDate: input.returnDate ? new Date(input.returnDate) : undefined,
        estimatedDays: input.estimatedDays,
        requiresLodging: input.requiresLodging ?? true,
        headcount: input.headcount ?? 1,
        mainTransportMode: input.mainTransportMode,
        approvedBudget: input.approvedBudget,
        approvedBy: input.approvedBy,
        notes: input.notes,
      },
    });
    return toAssignment(row);
  }

  async updateAssignmentStatus(input: {
    tenantId: string; travelId: string; status: string;
    actorUserId: string; orgId: string; roles: string[];
  }): Promise<TravelAssignmentRecord> {
    const allowed = ["DRAFT","PLANNED","ACTIVE","PENDING_SETTLEMENT","CLOSED","CANCELLED"];
    if (!allowed.includes(input.status)) throw new BadRequestException(`Invalid status: ${input.status}`);
    await this.getAssignment(input);

    if (!databaseEnabled()) {
      const a = MOCK_ASSIGNMENTS.find(x => x.id === input.travelId);
      if (!a) throw new NotFoundException("Not found");
      if (input.status === "PENDING_SETTLEMENT") {
        const expenses = MOCK_EXPENSES.filter(x => x.travelId === input.travelId);
        const lodging = MOCK_LODGINGS.filter(x => x.travelId === input.travelId);
        const advances = MOCK_ADVANCES.filter(x => x.travelId === input.travelId);
        if (expenses.length === 0 && lodging.length === 0 && advances.length === 0) {
          throw new BadRequestException("No puedes pasar a liquidación sin gastos, hospedaje o anticipos cargados.");
        }
        if (a.requiresLodging && lodging.length === 0) {
          throw new BadRequestException("Este viaje requiere hospedaje y aún no tiene registros cargados.");
        }
      }
      a.status = input.status; a.updatedAt = new Date().toISOString();
      return a;
    }
    const existing = await this.prisma.travelAssignment.findFirst({
      where: { id: input.travelId, tenantId: input.tenantId },
    });
    if (!existing) throw new NotFoundException("Travel assignment not found");
    if (input.status === "PENDING_SETTLEMENT") {
      const [expensesCount, lodgingCount, advancesCount] = await Promise.all([
        this.prisma.travelExpense.count({ where: { tenantId: input.tenantId, travelId: input.travelId } }),
        this.prisma.lodgingBooking.count({ where: { tenantId: input.tenantId, travelId: input.travelId } }),
        this.prisma.travelAdvance.count({ where: { tenantId: input.tenantId, travelId: input.travelId } }),
      ]);
      if (expensesCount === 0 && lodgingCount === 0 && advancesCount === 0) {
        throw new BadRequestException("No puedes pasar a liquidación sin gastos, hospedaje o anticipos cargados.");
      }
      if (existing.requiresLodging && lodgingCount === 0) {
        throw new BadRequestException("Este viaje requiere hospedaje y aún no tiene registros cargados.");
      }
    }
    const row = await this.prisma.travelAssignment.update({
      where: { id: input.travelId },
      data: { status: input.status },
    });
    return toAssignment(row);
  }

  // ── TravelExpense ──────────────────────────────────────────────────────────

  async listExpenses(input: {
    tenantId: string; travelId: string; category?: string;
    actorUserId: string; orgId: string; roles: string[];
  }): Promise<TravelExpenseRecord[]> {
    await this.getAssignment(input);
    if (!databaseEnabled()) return MOCK_EXPENSES.filter(e =>
      e.travelId === input.travelId && (!input.category || e.category === input.category)
    );
    const rows = await this.prisma.travelExpense.findMany({
      where: {
        tenantId: input.tenantId, travelId: input.travelId,
        ...(input.category ? { category: input.category } : {}),
      },
      orderBy: { expenseDate: "desc" },
    });
    return rows.map(toExpense);
  }

  async createExpense(input: {
    tenantId: string; travelId: string; submittedBy: string;
    category: string; subcategory?: string; description?: string;
    amount: number; currency?: string; expenseDate: string;
    city?: string; origin?: string; destination?: string; vendor?: string;
    odometer?: number; gallons?: number; receiptUrl?: string; notes?: string;
    actorUserId: string; orgId: string; roles: string[];
  }): Promise<TravelExpenseRecord> {
    const allowedCats = ["meal","transport","other"];
    if (!allowedCats.includes(input.category)) throw new BadRequestException("Invalid category");
    if (!(input.amount > 0)) throw new BadRequestException("amount must be positive");
    await this.getAssignment(input);

    if (!databaseEnabled()) {
      const rec: TravelExpenseRecord = {
        id: `exp_${Date.now()}`, tenantId: input.tenantId, travelId: input.travelId,
        submittedBy: input.submittedBy, category: input.category,
        subcategory: input.subcategory ?? null, description: input.description ?? null,
        amount: input.amount, currency: input.currency ?? "USD",
        expenseDate: new Date(input.expenseDate).toISOString(),
        city: input.city ?? null, origin: input.origin ?? null,
        destination: input.destination ?? null, vendor: input.vendor ?? null,
        odometer: input.odometer ?? null, gallons: input.gallons ?? null,
        receiptUrl: input.receiptUrl ?? null, status: "PENDING",
        approvedBy: null, approvedAt: null, notes: input.notes ?? null,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      MOCK_EXPENSES.push(rec);
      return rec;
    }

    const row = await this.prisma.travelExpense.create({
      data: {
        tenantId: input.tenantId, travelId: input.travelId,
        submittedBy: input.submittedBy, category: input.category,
        subcategory: input.subcategory, description: input.description,
        amount: input.amount, currency: input.currency ?? "USD",
        expenseDate: new Date(input.expenseDate),
        city: input.city, origin: input.origin, destination: input.destination,
        vendor: input.vendor, odometer: input.odometer, gallons: input.gallons,
        receiptUrl: input.receiptUrl, notes: input.notes,
      },
    });
    return toExpense(row);
  }

  // ── LodgingBooking ─────────────────────────────────────────────────────────

  async listLodging(input: {
    tenantId: string; travelId: string; actorUserId: string; orgId: string; roles: string[];
  }): Promise<LodgingBookingRecord[]> {
    await this.getAssignment(input);
    if (!databaseEnabled()) return MOCK_LODGINGS.filter(l => l.travelId === input.travelId);
    const rows = await this.prisma.lodgingBooking.findMany({
      where: { tenantId: input.tenantId, travelId: input.travelId },
      orderBy: { checkIn: "asc" },
    });
    return rows.map(toLodging);
  }

  async createLodging(input: {
    tenantId: string; travelId: string; type?: string; name: string;
    address?: string; placeId?: string; googleMapsUri?: string;
    latitude?: number; longitude?: number; checkIn: string; checkOut: string;
    costPerNight?: number; estimatedTotal?: number; confirmationCode?: string;
    paidBy?: string; receiptUrl?: string; notes?: string;
    actorUserId: string; orgId: string; roles: string[];
  }): Promise<LodgingBookingRecord> {
    if (!input.name?.trim()) throw new BadRequestException("name required");
    await this.getAssignment(input);

    if (!databaseEnabled()) {
      const rec: LodgingBookingRecord = {
        id: `ldg_${Date.now()}`, tenantId: input.tenantId, travelId: input.travelId,
        type: input.type ?? "hotel", name: input.name, address: input.address ?? null,
        placeId: input.placeId ?? null, googleMapsUri: input.googleMapsUri ?? null,
        latitude: input.latitude ?? null, longitude: input.longitude ?? null,
        checkIn: new Date(input.checkIn).toISOString(),
        checkOut: new Date(input.checkOut).toISOString(),
        costPerNight: input.costPerNight ?? null, estimatedTotal: input.estimatedTotal ?? null,
        actualTotal: null, confirmationCode: input.confirmationCode ?? null,
        paidBy: input.paidBy ?? null, status: "RESERVED",
        receiptUrl: input.receiptUrl ?? null, notes: input.notes ?? null,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      MOCK_LODGINGS.push(rec);
      return rec;
    }

    const row = await this.prisma.lodgingBooking.create({
      data: {
        tenantId: input.tenantId, travelId: input.travelId,
        type: input.type ?? "hotel", name: input.name, address: input.address,
        placeId: input.placeId, googleMapsUri: input.googleMapsUri,
        latitude: input.latitude, longitude: input.longitude,
        checkIn: new Date(input.checkIn), checkOut: new Date(input.checkOut),
        costPerNight: input.costPerNight, estimatedTotal: input.estimatedTotal,
        confirmationCode: input.confirmationCode, paidBy: input.paidBy,
        receiptUrl: input.receiptUrl, notes: input.notes,
      },
    });
    return toLodging(row);
  }

  // ── TravelAdvance ──────────────────────────────────────────────────────────

  async listAdvances(input: {
    tenantId: string; travelId: string; actorUserId: string; orgId: string; roles: string[];
  }): Promise<TravelAdvanceRecord[]> {
    await this.getAssignment(input);
    if (!databaseEnabled()) return MOCK_ADVANCES.filter(a => a.travelId === input.travelId);
    const rows = await this.prisma.travelAdvance.findMany({
      where: { tenantId: input.tenantId, travelId: input.travelId },
      orderBy: { issuedAt: "asc" },
    });
    return rows.map(toAdvance);
  }

  async createAdvance(input: {
    tenantId: string; travelId: string; issuedTo: string;
    amount: number; currency?: string; method?: string;
    approvedBy?: string; purpose?: string;
    actorUserId: string; orgId: string; roles: string[];
  }): Promise<TravelAdvanceRecord> {
    if (!(input.amount > 0)) throw new BadRequestException("amount must be positive");
    await this.getAssignment(input);

    if (!databaseEnabled()) {
      const rec: TravelAdvanceRecord = {
        id: `adv_${Date.now()}`, tenantId: input.tenantId, travelId: input.travelId,
        issuedTo: input.issuedTo, amount: input.amount, currency: input.currency ?? "USD",
        method: input.method ?? null, issuedAt: new Date().toISOString(),
        approvedBy: input.approvedBy ?? null, purpose: input.purpose ?? null,
        status: "ISSUED",
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      MOCK_ADVANCES.push(rec);
      return rec;
    }

    const row = await this.prisma.travelAdvance.create({
      data: {
        tenantId: input.tenantId, travelId: input.travelId, issuedTo: input.issuedTo,
        amount: input.amount, currency: input.currency ?? "USD",
        method: input.method, approvedBy: input.approvedBy, purpose: input.purpose,
      },
    });
    return toAdvance(row);
  }

  // ── TravelSettlement ───────────────────────────────────────────────────────

  async computeSettlement(input: {
    tenantId: string; travelId: string; actorUserId: string; orgId: string; roles: string[];
  }): Promise<TravelSettlementRecord> {
    // Load travel to get approvedBudget (also enforces access — see getAssignment)
    const travel = await this.getAssignment(input);

    if (!databaseEnabled()) {
      const expenses = MOCK_EXPENSES.filter(e => e.travelId === input.travelId && e.status !== "REJECTED");
      const advances = MOCK_ADVANCES.filter(a => a.travelId === input.travelId);
      const lodgings = MOCK_LODGINGS.filter(l => l.travelId === input.travelId);
      return this._buildSettlement(input.tenantId, input.travelId, travel, expenses, advances, lodgings);
    }

    const [expenses, advances, lodgings] = await Promise.all([
      this.prisma.travelExpense.findMany({ where: { tenantId: input.tenantId, travelId: input.travelId, status: { not: "REJECTED" } } }),
      this.prisma.travelAdvance.findMany({ where: { tenantId: input.tenantId, travelId: input.travelId } }),
      this.prisma.lodgingBooking.findMany({ where: { tenantId: input.tenantId, travelId: input.travelId } }),
    ]);

    const expRecs = expenses.map(toExpense);
    const advRecs = advances.map(toAdvance);
    const ldgRecs = lodgings.map(toLodging);
    const settlement = this._buildSettlement(input.tenantId, input.travelId, travel, expRecs, advRecs, ldgRecs);

    // Upsert settlement
    const data = {
      approvedBudget: settlement.approvedBudget,
      totalAdvances: settlement.totalAdvances,
      totalLodging: settlement.totalLodging,
      totalMeals: settlement.totalMeals,
      totalTransport: settlement.totalTransport,
      totalOther: settlement.totalOther,
      totalSpent: settlement.totalSpent,
      balanceDue: settlement.balanceDue,
    };

    const existing = await this.prisma.travelSettlement.findUnique({
      where: { travelId: input.travelId },
    });

    const row = existing
      ? await this.prisma.travelSettlement.update({ where: { id: existing.id }, data })
      : await this.prisma.travelSettlement.create({ data: { ...data, tenantId: input.tenantId, travelId: input.travelId } });

    return toSettlement(row);
  }

  async closeSettlement(input: {
    tenantId: string; travelId: string; closedBy: string; notes?: string;
    actorUserId: string; orgId: string; roles: string[];
  }): Promise<TravelSettlementRecord> {
    // Recompute first (also enforces access — see getAssignment)
    await this.computeSettlement(input);

    if (!databaseEnabled()) {
      let s = MOCK_SETTLEMENTS.find(x => x.travelId === input.travelId);
      if (!s) { s = await this.computeSettlement(input); }
      s.status = "CLOSED"; s.closedBy = input.closedBy;
      s.closedAt = new Date().toISOString(); s.notes = input.notes ?? s.notes;
      // Also close the travel assignment
      const a = MOCK_ASSIGNMENTS.find(x => x.id === input.travelId);
      if (a) a.status = "CLOSED";
      return s;
    }

    const existing = await this.prisma.travelSettlement.findFirst({
      where: { travelId: input.travelId, tenantId: input.tenantId },
    });
    if (!existing) throw new NotFoundException("Travel settlement not found");

    const row = await this.prisma.travelSettlement.update({
      where: { id: existing.id },
      data: { status: "CLOSED", closedBy: input.closedBy, closedAt: new Date(), notes: input.notes },
    });
    await this.prisma.travelAssignment.updateMany({
      where: { id: input.travelId, tenantId: input.tenantId },
      data: { status: "CLOSED" },
    });
    return toSettlement(row);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private _buildSettlement(
    tenantId: string,
    travelId: string,
    travel: TravelAssignmentRecord,
    expenses: TravelExpenseRecord[],
    advances: TravelAdvanceRecord[],
    lodgings: LodgingBookingRecord[],
  ): TravelSettlementRecord {
    const totalAdvances = advances.reduce((s, a) => s + a.amount, 0);
    const totalMeals = expenses.filter(e => e.category === "meal").reduce((s, e) => s + e.amount, 0);
    const totalTransport = expenses.filter(e => e.category === "transport").reduce((s, e) => s + e.amount, 0);
    const totalOther = expenses.filter(e => e.category === "other").reduce((s, e) => s + e.amount, 0);
    const totalLodging = lodgings.reduce((s, l) => s + (l.actualTotal ?? l.estimatedTotal ?? 0), 0);
    const totalSpent = totalMeals + totalTransport + totalOther + totalLodging;
    // positive = worker owes back; negative = company owes worker
    const balanceDue = totalAdvances - totalSpent;

    return {
      id: `set_${Date.now()}`, tenantId, travelId,
      approvedBudget: travel.approvedBudget,
      totalAdvances, totalLodging, totalMeals, totalTransport, totalOther,
      totalSpent, balanceDue, status: "DRAFT",
      notes: null, closedBy: null, closedAt: null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
  }
}
