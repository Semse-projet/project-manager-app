import { useEffect, useState } from "react";
import { listClientDocuments } from "@/domains/client/documents/repository";
import type { ClientDocument } from "@/domains/client/documents/types";

export function useClientDocuments(): { documents: ClientDocument[]; loading: boolean } {
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      const nextDocuments = await listClientDocuments();
      if (cancelled) {
        return;
      }
      setDocuments(nextDocuments);
      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  return { documents, loading };
}
