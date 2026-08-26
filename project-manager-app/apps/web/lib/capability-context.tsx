"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchMyCapabilities, type UserCapabilityView } from "../app/semse-api";

type CapabilityStateValue = {
  capabilities: UserCapabilityView[];
  loading: boolean;
  activeProjectOrgId: string | null;
  setActiveProjectOrgId: (orgId: string | null) => void;
};

const CapabilityStateContext = createContext<CapabilityStateValue | null>(null);

export function CapabilityProvider({ children }: { children: ReactNode }) {
  const [capabilities, setCapabilities] = useState<UserCapabilityView[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProjectOrgId, setActiveProjectOrgId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMyCapabilities()
      .then((result) => {
        if (!cancelled) setCapabilities(result);
      })
      .catch(() => {
        if (!cancelled) setCapabilities([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<CapabilityStateValue>(() => ({
    capabilities,
    loading,
    activeProjectOrgId,
    setActiveProjectOrgId,
  }), [capabilities, loading, activeProjectOrgId]);

  return (
    <CapabilityStateContext.Provider value={value}>
      {children}
    </CapabilityStateContext.Provider>
  );
}

export function useCapabilityState(): CapabilityStateValue {
  const value = useContext(CapabilityStateContext);
  if (!value) {
    throw new Error("useCapabilityState must be used within CapabilityProvider");
  }
  return value;
}

/**
 * Project-detail pages declare their own orgId here so the header indicator
 * and per-project badge can derive the active capability from real open-project
 * context — never a saved preference. Resets to null on unmount so leaving the
 * project clears the derived capability instead of leaving it stale.
 */
export function useDeclareActiveProjectOrg(orgId: string | null): void {
  const { setActiveProjectOrgId } = useCapabilityState();

  useEffect(() => {
    setActiveProjectOrgId(orgId);
    return () => setActiveProjectOrgId(null);
  }, [orgId, setActiveProjectOrgId]);
}
