import { useEffect, useState } from "react";
import { listClientEscrowPayments } from "@/domains/client/payments/repository";
import type { ClientEscrowPayment } from "@/domains/client/payments/types";

export function useClientPayments(): { payments: ClientEscrowPayment[]; loading: boolean } {
  const [payments, setPayments] = useState<ClientEscrowPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      const nextPayments = await listClientEscrowPayments();
      if (cancelled) {
        return;
      }
      setPayments(nextPayments);
      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return { payments, loading };
}
