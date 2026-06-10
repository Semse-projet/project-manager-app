"use client";

import React, { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { Star, ChevronLeft, ChevronRight, TrendingUp, ShieldCheck, ArrowRight } from "lucide-react";
import { PublicLandingProfessional } from "../../lib/public-landing";

interface ProfessionalsCarouselProps {
  professionals: PublicLandingProfessional[];
}

const FALLBACK_PROFESSIONALS: PublicLandingProfessional[] = [
  {
    id: "pro-1",
    displayName: "Ing. Carlos Mendoza",
    completedProjects: 48,
    avgClientRating: 4.9,
    trustScore: 98,
    specialties: ["Drywall", "Pintura comercial", "Remodelación residencial"],
    badges: ["Verificado", "Top Pro"],
    publicSlug: "carlos-mendoza",
    verifiedAt: new Date().toISOString(),
  },
  {
    id: "pro-2",
    displayName: "Adrián Reyes",
    completedProjects: 34,
    avgClientRating: 5.0,
    trustScore: 96,
    specialties: ["Electricidad", "Cableado estructurado", "Iluminación LED"],
    badges: ["Verificado"],
    publicSlug: "adrian-reyes",
    verifiedAt: new Date().toISOString(),
  },
  {
    id: "pro-3",
    displayName: "Francisco 'Paco' Ortiz",
    completedProjects: 57,
    avgClientRating: 4.8,
    trustScore: 97,
    specialties: ["Plomería técnica", "Calentadores", "Inspección de fugas"],
    badges: ["Verificado", "Experto"],
    publicSlug: "paco-ortiz",
    verifiedAt: new Date().toISOString(),
  },
  {
    id: "pro-4",
    displayName: "Martín R. Villanueva",
    completedProjects: 29,
    avgClientRating: 4.9,
    trustScore: 94,
    specialties: ["HVAC", "Aire Acondicionado", "Mantenimiento Preventivo"],
    badges: ["Verificado"],
    publicSlug: "martin-villanueva",
    verifiedAt: new Date().toISOString(),
  },
  {
    id: "pro-5",
    displayName: "Héctor Gómez S.",
    completedProjects: 41,
    avgClientRating: 4.7,
    trustScore: 92,
    specialties: ["Carpintería fina", "Cocinas a medida", "Instalación de pisos"],
    badges: ["Verificado"],
    publicSlug: "hector-gomez",
    verifiedAt: new Date().toISOString(),
  },
];

export function ProfessionalsCarousel({ professionals }: ProfessionalsCarouselProps) {
  const items = professionals.length > 0 ? professionals : FALLBACK_PROFESSIONALS;
  const containerRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);

  const checkScrollLimits = () => {
    if (containerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = containerRef.current;
      setShowLeftArrow(scrollLeft > 10);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    const el = containerRef.current;
    if (el) {
      el.addEventListener("scroll", checkScrollLimits);
      // Run once initially
      checkScrollLimits();
      // Handle resize
      window.addEventListener("resize", checkScrollLimits);
    }
    return () => {
      if (el) el.removeEventListener("scroll", checkScrollLimits);
      window.removeEventListener("resize", checkScrollLimits);
    };
  }, [items.length]);

  const scroll = (dir: "left" | "right") => {
    if (containerRef.current) {
      const { clientWidth } = containerRef.current;
      const scrollAmount = clientWidth * 0.75;
      containerRef.current.scrollBy({
        left: dir === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="relative group max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      {/* Scroll Arrows */}
      {showLeftArrow && (
        <button
          onClick={() => scroll("left")}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850 hover:shadow-lg flex items-center justify-center cursor-pointer shadow-md active:scale-95 transition-all duration-200"
          aria-label="Desplazar a la izquierda"
        >
          <ChevronLeft size={24} />
        </button>
      )}

      {showRightArrow && (
        <button
          onClick={() => scroll("right")}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-850 hover:shadow-lg flex items-center justify-center cursor-pointer shadow-md active:scale-95 transition-all duration-200"
          aria-label="Desplazar a la derecha"
        >
          <ChevronRight size={24} />
        </button>
      )}

      {/* Draggable/Scrollable Container */}
      <div
        ref={containerRef}
        className="flex gap-6 overflow-x-auto pb-6 pt-2 px-1 scroll-smooth snap-x snap-mandatory scrollbar-none"
        style={{ scrollbarWidth: "none" }}
      >
        {items.map((pro) => (
          <Link
            key={pro.id}
            href={pro.publicSlug ? `/pro/${pro.publicSlug}` : "/login"}
            className="flex-shrink-0 w-[290px] sm:w-[325px] bg-white dark:bg-slate-900/60 hover:bg-slate-50/50 dark:hover:bg-slate-900 border border-slate-200/60 dark:border-slate-800/80 hover:border-blue-500/60 dark:hover:border-blue-500/60 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 snap-start transition-all duration-300 no-underline text-slate-900 dark:text-slate-100 flex flex-col justify-between group/card relative"
          >
            {/* Glowing Accent Ring on Hover */}
            <div className="absolute inset-0 rounded-3xl border border-transparent group-hover/card:border-blue-500/20 group-hover/card:shadow-[0_0_25px_rgba(59,130,246,0.15)] pointer-events-none transition-all duration-300" />

            <div>
              {/* Header block with Name & Verify Badge */}
              <div className="flex justify-between items-start gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white group-hover/card:text-blue-600 dark:group-hover/card:text-blue-400 transition-colors duration-200 flex items-center gap-1.5">
                    {pro.displayName}
                    {pro.verifiedAt && (
                      <ShieldCheck size={18} className="text-blue-500 fill-blue-500/10 shrink-0" />
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 font-bold tracking-wide uppercase mt-1">
                    {pro.completedProjects} proyectos listados
                  </p>
                </div>
                <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 uppercase">
                  <TrendingUp size={10} />
                  <span>{pro.trustScore} trust</span>
                </div>
              </div>

              {/* Specialties badges */}
              <div className="flex flex-wrap gap-1.5 mb-6">
                {pro.specialties.map((specialty) => (
                  <span
                    key={specialty}
                    className="text-[10px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-200/20 dark:border-slate-850"
                  >
                    {specialty}
                  </span>
                ))}
              </div>
            </div>

            {/* Card Footer */}
            <div className="flex justify-between items-center text-xs font-bold border-t border-slate-100 dark:border-slate-800/60 pt-4 mt-2">
              <span className="flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-md text-amber-700 dark:text-amber-400">
                <Star size={12} className="fill-current text-amber-500" />
                <span>{pro.avgClientRating > 0 ? pro.avgClientRating.toFixed(1) : "5.0"}</span>
              </span>
              <span className="text-blue-600 dark:text-blue-400 flex items-center gap-1 group-hover/card:translate-x-1 transition-transform duration-200">
                Ver perfil <ArrowRight size={12} />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
