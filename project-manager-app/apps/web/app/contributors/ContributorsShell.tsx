"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { HardHat, Globe } from "lucide-react";
import { LanguageProvider, useLanguage } from "../../lib/language-context";

function LanguageSwitch() {
  const { language, setLanguage } = useLanguage();
  return (
    <div className="flex items-center gap-1 text-xs font-semibold">
      <Globe size={14} className="text-faint" aria-hidden />
      <button
        type="button"
        onClick={() => setLanguage("es")}
        className={language === "es" ? "text-brand" : "text-muted hover:text-ink"}
      >
        Español
      </button>
      <span className="text-faint">|</span>
      <button
        type="button"
        onClick={() => setLanguage("en")}
        className={language === "en" ? "text-brand" : "text-muted hover:text-ink"}
      >
        English
      </button>
    </div>
  );
}

function Header() {
  const { t } = useLanguage();
  return (
    <header className="sticky top-0 z-20 border-b border-white/[0.08] bg-[#07071a]/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/contributors" className="flex items-center gap-2 text-sm font-bold text-ink">
          <HardHat size={20} className="text-brand" aria-hidden />
          <span className="hidden sm:inline">{t("contributors.title")}</span>
          <span className="sm:hidden">SEMSE Contributors</span>
        </Link>
        <nav className="flex items-center gap-4">
          <Link href="/contributors/terms" className="hidden text-xs font-semibold text-muted hover:text-ink sm:inline">
            {t("contributors.cta.readTerms")}
          </Link>
          <LanguageSwitch />
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="border-t border-white/[0.08] py-8 text-center text-xs text-faint">
      <p>
        © {new Date().getFullYear()} SEMSEproject —{" "}
        <Link href="/contributors/terms" className="underline hover:text-muted">
          {t("contributors.terms.title")}
        </Link>
      </p>
    </footer>
  );
}

export function ContributorsShell({ children }: { children: ReactNode }) {
  return (
    <LanguageProvider>
      <div className="public-theme flex min-h-screen flex-col" style={{ background: "var(--bg, #07071a)", color: "var(--ink, #f5f5fa)" }}>
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </LanguageProvider>
  );
}
