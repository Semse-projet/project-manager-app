import { useEffect, useState } from "react";
import { listClientProposals } from "@/domains/client/proposals/repository";
import type { ClientProposal } from "@/domains/client/proposals/types";

export function useClientProposals(): { proposals: ClientProposal[]; loading: boolean } {
  const [proposals, setProposals] = useState<ClientProposal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      const nextProposals = await listClientProposals();
      if (cancelled) {
        return;
      }
      setProposals(nextProposals);
      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return { proposals, loading };
}
