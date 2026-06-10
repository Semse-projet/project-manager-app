"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Menu, X, Sparkles, LogIn, PlusCircle, Sun, Moon } from "lucide-react";

const NAV_LINKS = [
  { label: "Servicios", href: "#servicios" },
  { label: "Cómo funciona", href: "#como-funciona" },
  { label: "Prometeo IA", href: "#prometeo" },
  { label: "Profesionales", href: "#profesionales" },
];

export function LandingNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    // Sync with page state or localStorage
    const savedTheme = localStorage.getItem("public-theme");
    const docTheme = document.documentElement.getAttribute("data-theme");
    
    if (savedTheme === "dark" || docTheme === "dark") {
      setTheme("dark");
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      setTheme("light");
      document.documentElement.setAttribute("data-theme", "light");
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("public-theme", nextTheme);
  };

  return (
    <nav className="sticky top-0 z-50 w-full bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group no-underline">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform duration-200">
              S
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white leading-none group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">
                SEMSE Project
              </span>
              <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold tracking-widest uppercase mt-0.5">
                Plataforma Operativa
              </span>
            </div>
          </Link>

          {/* Nav Links - Desktop */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all duration-150"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Action Buttons - Desktop */}
          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-colors duration-150 cursor-pointer"
              aria-label="Cambiar tema"
            >
              {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-150"
            >
              <LogIn size={15} className="text-slate-400" />
              <span>Ingresar</span>
            </Link>
            <Link
              href="/client/jobs/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 active:scale-98 transition-all duration-150"
            >
              <Sparkles size={14} />
              <span>Publicar proyecto</span>
            </Link>
          </div>

          {/* Hamburger Menu & Theme Toggle - Mobile */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 transition-colors duration-150 cursor-pointer"
              aria-label="Cambiar tema"
            >
              {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 focus:outline-none transition-colors duration-150"
              aria-controls="mobile-menu"
              aria-expanded="false"
            >
              <span className="sr-only">Abrir menú principal</span>
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={`md:hidden transition-all duration-300 ease-in-out ${
          menuOpen ? "max-height-screen opacity-100 border-t border-slate-200/50 dark:border-slate-800/50" : "max-h-0 opacity-0 overflow-hidden pointer-events-none"
        }`}
        id="mobile-menu"
      >
        <div className="px-4 pt-3 pb-4 space-y-1 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md shadow-lg">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="block px-3 py-2.5 rounded-lg text-base font-medium text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors duration-150"
            >
              {link.label}
            </a>
          ))}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800/50 flex flex-col gap-2">
            <Link
              href="/login"
              onClick={() => setMenuOpen(false)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors duration-150"
            >
              <LogIn size={15} />
              <span>Ingresar</span>
            </Link>
            <Link
              href="/client/jobs/new"
              onClick={() => setMenuOpen(false)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 shadow-sm transition-opacity duration-150 hover:opacity-95"
            >
              <PlusCircle size={15} />
              <span>Publicar proyecto</span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

