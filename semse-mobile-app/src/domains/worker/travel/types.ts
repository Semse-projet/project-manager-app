export type WorkerTrip = {
  id: string;
  destination: string;
  origin: string;
  status: "active" | "scheduled" | "completed";
  rawStatus?: "DRAFT" | "PLANNED" | "ACTIVE" | "PENDING_SETTLEMENT" | "CLOSED" | "CANCELLED";
  startDate: string;
  endDate: string;
  objective: string;
  transport: string;
  accommodation: string;
  jobTitle?: string;
  estimatedDays?: number | null;
  approvedBudget?: number | null;
  totalSpent?: number | null;
  expectedBalance?: number | null;
  receiptCount?: number;
  missingReceipts?: number;
  missingExpenseReceipts?: number;
  missingLodgingReceipts?: number;
  expenseCount?: number;
  lodgingCount?: number;
  advanceCount?: number;
  readyToClose?: boolean;
  blockedReason?: string | null;
  requiresLodging?: boolean;
};

export type WorkerTravelExpense = {
  id: string;
  travelId?: string;
  concept: string;
  amount: number;
  category: string;
  date: string;
  status: "pending" | "approved" | "rejected";
  hasReceipt?: boolean;
};

export type WorkerHotelReservation = {
  id: string;
  travelId?: string;
  hotelName: string;
  address: string;
  checkIn: string;
  checkOut: string;
  confirmationCode: string;
  status: "confirmed" | "pending";
  hasReceipt?: boolean;
};
