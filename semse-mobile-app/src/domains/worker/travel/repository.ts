import { expenses, hotelReservations, trips } from "@/data/mockData";
import { mobileFetchContract, SEMSE_CONTRACTS } from "@/lib/api/contracts";
import { MOBILE_ENV } from "@/lib/config/env";
import { trackTelemetryEvent } from "@/lib/observability/telemetry";
import { toWorkerHotelReservation, toWorkerTravelExpense, toWorkerTrip } from "@/domains/worker/travel/adapters";
import type { WorkerHotelReservation, WorkerTravelExpense, WorkerTrip } from "@/domains/worker/travel/types";

type WorkerTravelPayload = {
  trips: WorkerTrip[];
  expenses: WorkerTravelExpense[];
  reservations: WorkerHotelReservation[];
};

function mockWorkerTravelPayload(): WorkerTravelPayload {
  return {
    trips: trips.map(toWorkerTrip),
    expenses: expenses.map(toWorkerTravelExpense),
    reservations: hotelReservations.map(toWorkerHotelReservation),
  };
}

function mapTravelRecordToTrip(record: Record<string, unknown>): WorkerTrip {
  const rawStatus =
    record.status === "DRAFT" ||
    record.status === "PLANNED" ||
    record.status === "ACTIVE" ||
    record.status === "PENDING_SETTLEMENT" ||
    record.status === "CLOSED" ||
    record.status === "CANCELLED"
      ? record.status
      : "DRAFT";

  return {
    id: typeof record.id === "string" ? record.id : "travel_unknown",
    destination: typeof record.destinationCity === "string" ? record.destinationCity : "Destino por confirmar",
    origin: typeof record.originCity === "string" ? record.originCity : "Base SEMSE",
    status: rawStatus === "ACTIVE" ? "active" : rawStatus === "CLOSED" || rawStatus === "CANCELLED" ? "completed" : "scheduled",
    rawStatus,
    startDate: typeof record.departureDate === "string" ? record.departureDate : "Sin fecha",
    endDate: typeof record.returnDate === "string" ? record.returnDate : "Sin fecha",
    objective: typeof record.notes === "string" ? record.notes : "Traslado operativo",
    transport: typeof record.mainTransportMode === "string" ? record.mainTransportMode : "Por definir",
    accommodation: typeof record.requiresLodging === "boolean" && record.requiresLodging ? "Requiere hospedaje" : "Sin hospedaje",
    jobTitle: typeof record.jobTitle === "string" ? record.jobTitle : undefined,
    estimatedDays: typeof record.estimatedDays === "number" ? record.estimatedDays : null,
    approvedBudget: typeof record.approvedBudget === "number" ? record.approvedBudget : null,
    requiresLodging: typeof record.requiresLodging === "boolean" ? record.requiresLodging : undefined,
  };
}

function mapTravelExpenseRecord(record: Record<string, unknown>): WorkerTravelExpense {
  return {
    id: typeof record.id === "string" ? record.id : "expense_unknown",
    travelId: typeof record.travelAssignmentId === "string" ? record.travelAssignmentId : undefined,
    concept: typeof record.description === "string" ? record.description : "Gasto de viaje",
    amount: typeof record.amount === "number" ? record.amount : 0,
    category: typeof record.category === "string" ? record.category : "other",
    date: typeof record.expenseDate === "string" ? record.expenseDate : "Sin fecha",
    status: record.status === "APPROVED" ? "approved" : record.status === "REJECTED" ? "rejected" : "pending",
    hasReceipt: Boolean(String(record.receiptUrl ?? "").trim()),
  };
}

function mapLodgingRecord(record: Record<string, unknown>): WorkerHotelReservation {
  return {
    id: typeof record.id === "string" ? record.id : "lodging_unknown",
    travelId: typeof record.travelAssignmentId === "string" ? record.travelAssignmentId : undefined,
    hotelName: typeof record.name === "string" ? record.name : "Hospedaje SEMSE",
    address: typeof record.address === "string" ? record.address : "Dirección por confirmar",
    checkIn: typeof record.checkIn === "string" ? record.checkIn : "Sin fecha",
    checkOut: typeof record.checkOut === "string" ? record.checkOut : "Sin fecha",
    confirmationCode: typeof record.confirmationCode === "string" ? record.confirmationCode : "PENDIENTE",
    status: record.status === "CONFIRMED" ? "confirmed" : "pending",
    hasReceipt: Boolean(String(record.receiptUrl ?? "").trim()),
  };
}

export async function getWorkerTravelSnapshot(): Promise<WorkerTravelPayload> {
  if (MOBILE_ENV.runtimeMode === "mock") {
    const payload = mockWorkerTravelPayload();
    trackTelemetryEvent({ name: "worker.travel.mock_loaded", surface: "worker.travel", metadata: { trips: payload.trips.length, expenses: payload.expenses.length } });
    return payload;
  }

  const payload = await mobileFetchContract<Record<string, unknown>[]>(
    SEMSE_CONTRACTS.travel.list,
  )
    .then(async (assignments) => {
      const baseTrips = assignments.map(mapTravelRecordToTrip);
      const expenseGroups = await Promise.all(
        baseTrips.map((trip) =>
          mobileFetchContract<Record<string, unknown>[]>(SEMSE_CONTRACTS.travel.expenses(trip.id))
            .then((records) => records.map(mapTravelExpenseRecord))
            .catch(() => []),
        ),
      );
      const lodgingGroups = await Promise.all(
        baseTrips.map((trip) =>
          mobileFetchContract<Record<string, unknown>[]>(SEMSE_CONTRACTS.travel.lodging(trip.id))
            .then((records) => records.map(mapLodgingRecord))
            .catch(() => []),
        ),
      );
      const advanceGroups = await Promise.all(
        baseTrips.map((trip) =>
          mobileFetchContract<Record<string, unknown>[]>(SEMSE_CONTRACTS.travel.advances(trip.id))
            .catch(() => []),
        ),
      );

      const trips = baseTrips.map((trip, index) => {
        const tripExpenses = expenseGroups[index];
        const tripLodging = lodgingGroups[index];
        const tripAdvances = advanceGroups[index];
        const totalSpent = tripExpenses.reduce((sum, expense) => sum + expense.amount, 0);
        const missingExpenseReceipts = tripExpenses.filter((expense) => !expense.hasReceipt).length;
        const missingLodgingReceipts = tripLodging.filter((reservation) => !reservation.hasReceipt).length;
        const receiptCount = tripExpenses.filter((expense) => expense.hasReceipt).length + tripLodging.filter((reservation) => reservation.hasReceipt).length;
        const missingReceipts = missingExpenseReceipts + missingLodgingReceipts;
        const expectedBalance = typeof trip.approvedBudget === "number" ? trip.approvedBudget - totalSpent : null;
        const readyToClose = trip.rawStatus === "PENDING_SETTLEMENT" && missingReceipts === 0;
        const blockedReason =
          trip.rawStatus === "ACTIVE" && tripExpenses.length === 0 && tripLodging.length === 0 && tripAdvances.length === 0
            ? "sin base operativa"
            : trip.requiresLodging && trip.rawStatus === "ACTIVE" && tripLodging.length === 0
              ? "sin hospedaje requerido"
              : null;

        return {
          ...trip,
          totalSpent,
          expectedBalance,
          receiptCount,
          missingReceipts,
          missingExpenseReceipts,
          missingLodgingReceipts,
          expenseCount: tripExpenses.length,
          lodgingCount: tripLodging.length,
          advanceCount: tripAdvances.length,
          readyToClose,
          blockedReason,
        };
      });

      return {
        trips,
        expenses: expenseGroups.flat(),
        reservations: lodgingGroups.flat(),
      };
    })
    .catch(() => {
      if (MOBILE_ENV.allowMockFallback) {
        return mockWorkerTravelPayload();
      }
      throw new Error("worker.travel contract fetch failed");
    });

  trackTelemetryEvent({ name: "worker.travel.loaded", surface: "worker.travel", metadata: { trips: payload.trips.length, expenses: payload.expenses.length, mode: MOBILE_ENV.runtimeMode } });
  return payload;
}
