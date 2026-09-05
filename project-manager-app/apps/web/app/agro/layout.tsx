import type { ReactNode } from "react";
import { DemoBanner } from "../../components/demo/demo-banner";
import { AgroSyncProvider } from "./AgroSyncProvider";
import { AgroSyncBanner } from "./AgroSyncBanner";

export default function AgroLayout({ children }: { children: ReactNode }) {
  return (
    <AgroSyncProvider>
      <DemoBanner />
      <AgroSyncBanner />
      {children}
    </AgroSyncProvider>
  );
}
