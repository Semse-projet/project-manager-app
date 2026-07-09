import type { ReactNode } from "react";
import { DemoBanner } from "../../components/demo/demo-banner";

export default function AgroLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <DemoBanner />
      {children}
    </>
  );
}
