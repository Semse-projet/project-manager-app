import type { Expense, HotelReservation, Trip } from "@/types";
import type { WorkerHotelReservation, WorkerTravelExpense, WorkerTrip } from "@/domains/worker/travel/types";

export function toWorkerTrip(trip: Trip): WorkerTrip {
  return {
    id: trip.id,
    destination: trip.destination,
    origin: trip.origin,
    status: trip.status,
    startDate: trip.startDate,
    endDate: trip.endDate,
    objective: trip.objective,
    transport: trip.transport,
    accommodation: trip.accommodation,
  };
}

export function toWorkerTravelExpense(expense: Expense): WorkerTravelExpense {
  return {
    id: expense.id,
    concept: expense.concept,
    amount: expense.amount,
    category: expense.category,
    date: expense.date,
    status: expense.status,
  };
}

export function toWorkerHotelReservation(reservation: HotelReservation): WorkerHotelReservation {
  return {
    id: reservation.id,
    hotelName: reservation.hotelName,
    address: reservation.address,
    checkIn: reservation.checkIn,
    checkOut: reservation.checkOut,
    confirmationCode: reservation.confirmationCode,
    status: reservation.status,
  };
}
