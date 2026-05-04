import type { ReactNode } from "react";
import { LandingFooter } from "../../components/landing/landing-footer";
import { LandingNav } from "../../components/landing/landing-nav";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="public-theme" style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--ink)" }}>
      <LandingNav />
      {children}
      <LandingFooter />
    </div>
  );
}
