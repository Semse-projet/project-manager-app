import { useEffect, useState } from "react";
import { getWorkerTravelSnapshot } from "@/domains/worker/travel/repository";
import type { WorkerHotelReservation, WorkerTravelExpense, WorkerTrip } from "@/domains/worker/travel/types";

type WorkerTravelState = {
  trips: WorkerTrip[];
  expenses: WorkerTravelExpense[];
  reservations: WorkerHotelReservation[];
  loading: boolean;
};

export function useWorkerTravel(): WorkerTravelState {
  const [state, setState] = useState<WorkerTravelState>({
    trips: [],
    expenses: [],
    reservations: [],
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      const snapshot = await getWorkerTravelSnapshot();
      if (cancelled) {
        return;
      }
      setState({
        trips: snapshot.trips,
        expenses: snapshot.expenses,
        reservations: snapshot.reservations,
        loading: false,
      });
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
