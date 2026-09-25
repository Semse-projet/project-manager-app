import { z } from "zod";

// Matches TravelAssignmentRecord in apps/api/src/modules/travel/travel.service.ts —
// the shape returned by GET /v1/travel and GET /v1/travel/:travelId.
// Read-only for now — mobile only lists/views assignments, it doesn't create
// or edit expenses/lodging/advances yet.
export const travelAssignmentRecordSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  jobId: z.string().min(1),
  assignedTo: z.string().min(1),
  destinationCity: z.string().min(1),
  departureDate: z.string().min(1),
  returnDate: z.string().nullable(),
  estimatedDays: z.number().nullable(),
  requiresLodging: z.boolean(),
  headcount: z.number(),
  mainTransportMode: z.string().nullable(),
  approvedBudget: z.number().nullable(),
  approvedBy: z.string().nullable(),
  status: z.string().min(1),
  notes: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1)
});

// Matches GET /v1/travel/summary's per-assignment shape (listAssignmentsWithSummary).
export const travelAssignmentSummarySchema = travelAssignmentRecordSchema.extend({
  totalSpent: z.number().nullable(),
  expectedBalance: z.number().nullable(),
  missingReceipts: z.number(),
  missingExpenseReceipts: z.number(),
  missingLodgingReceipts: z.number(),
  receiptCount: z.number(),
  expenseCount: z.number(),
  lodgingCount: z.number(),
  advanceCount: z.number()
});

export type TravelAssignmentRecordView = z.infer<typeof travelAssignmentRecordSchema>;
export type TravelAssignmentSummaryView = z.infer<typeof travelAssignmentSummarySchema>;
