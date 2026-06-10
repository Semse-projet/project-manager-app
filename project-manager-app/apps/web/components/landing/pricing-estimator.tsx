"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Check,
  Percent,
  Sliders,
  Maximize2,
  AlertCircle
} from "lucide-react";
import Link from "next/link";

interface CategoryDef {
  id: string;
  name: string;
  icon: string;
  unit: string;
  minArea: number;
  maxArea: number;
  defaultArea: number;
  rates: {
    basico: number;
    estandar: number;
    premium: number;
  };
  features: {
    basico: string[];
    estandar: string[];
    premium: string[];
  };
}

const CATEGORIES: CategoryDef[] = [
  {
    id: "drywall",
    name: "Drywall & Pintura",
    icon: "🎨",
    unit: "m² de superficie",
    minArea: 10,
    maxArea: 300,
    defaultArea: 50,
    rates: {
      basico: 120, // MXN per unit
      estandar: 220,
      premium: 380
    },
    features: {
      basico: [
        "Pintura a 1 mano económica",
        "Resane de orificios menores",
        "Sellador de muros básico",
        "Protección básica de pisos"
      ],
      estandar: [
        "Pintura a 2 manos intermedia",
        "Resane blend-to-match en juntas",
        "Sellador acrílico de alta adherencia",
        "Corrección de fisuras superficiales",
        "Limpieza intermedia al terminar"
      ],
      premium: [
        "Pintura a 3 manos Sherwin-Williams/Comex",
        "Plasteado y alisado completo de muros",
        "Tratamiento antihumedad previo",
        "Pintura lavable satinada premium",
        "Limpieza profunda post-obra",
        "Garantía de 1 año en adherencia"
      ]
    }
  },
  {
    id: "bathroom",
    name: "Remodelación de Baño",
    icon: "🛁",
    unit: "m² de piso/pared",
    minArea: 3,
    maxArea: 25,
    defaultArea: 6,
    rates: {
      basico: 3200,
      estandar: 5500,
      premium: 9500
    },
    features: {
      basico: [
        "Colocación de loseta cerámica estándar",
        "Cambio de grifería y sanitarios económicos",
        "Instalación hidráulica básica expuesta",
        "Boquilla de cemento gris estándar"
      ],
      estandar: [
        "Loseta porcelánica de gran formato",
        "Impermeabilización total de zona húmeda",
        "Nicho empotrado para jabonera",
        "Grifería Helvex o equivalente",
        "Boquilla epóxica antihongos"
      ],
      premium: [
        "Placa de mármol o granito exótico",
        "Cancelería de vidrio templado de 9mm",
        "Grifería oculta/empotrada monomando",
        "Sanitario suspendido de alta gama",
        "Iluminación LED cálida perimetral indirecta",
        "Extractor de aire silencioso inteligente"
      ]
    }
  },
  {
    id: "kitchen",
    name: "Remodelación de Cocina",
    icon: "🍳",
    unit: "m² de área total",
    minArea: 5,
    maxArea: 40,
    defaultArea: 12,
    rates: {
      basico: 4500,
      estandar: 8000,
      premium: 14000
    },
    features: {
      basico: [
        "Gabinetes de melamina de 15mm blanco",
        "Tarja sencilla de submontar acero inox",
        "Cubierta de melamina imitación madera",
        "Bisagras estándar sin freno"
      ],
      estandar: [
        "Gabinetes de MDF pintado o termoformado",
        "Cubierta de cuarzo o granito nacional",
        "Tarja doble de acero inoxidable grueso",
        "Herrajes con cierre suave (soft-close)",
        "Iluminación LED bajo gabinetes"
      ],
      premium: [
        "Diseño a medida en madera sólida o acrílico anti-huella",
        "Cubierta de granito exótico o Dekton",
        "Herrajes Blum/Häfele de alta durabilidad",
        "Torre de hornos y cajones organizadores",
        "Tarja de cuarzo compuesto con monomando extraíble",
        "Sistema de basura oculto y despensa extraíble"
      ]
    }
  },
  {
    id: "maintenance",
    name: "Mantenimiento General",
    icon: "🔧",
    unit: "m² de propiedad",
    minArea: 20,
    maxArea: 500,
    defaultArea: 100,
    rates: {
      basico: 80,
      estandar: 160,
      premium: 280
    },
    features: {
      basico: [
        "Inspección visual y diagnóstico general",
        "Ajuste y lubricación de chapas y puertas",
        "Limpieza y lavado de filtros de A/C",
        "Sustitución de bombillas fundidas"
      ],
      estandar: [
        "Limpieza y desazolve de desagües fluviales",
        "Retoque de pintura en áreas dañadas",
        "Revisión y balanceo de tablero eléctrico",
        "Cambio de empaques e inspección de fugas de agua",
        "Pruebas de presión hidráulica"
      ],
      premium: [
        "Mantenimiento preventivo de aire acondicionado",
        "Impermeabilización acrílica (garantía 3 años)",
        "Lavado a presión de fachadas y cocheras",
        "Auditoría térmica con IA (detección de fugas)",
        "Plan de mantenimiento anual programado",
        "Soporte prioritario 24/7 para emergencias"
      ]
    }
  }
];

export function PricingEstimator() {
  const [activeCategory, setActiveCategory] = useState<string>("drywall");
  const [area, setArea] = useState<number>(50);
  const [tier, setTier] = useState<"basico" | "estandar" | "premium">("estandar");

  const category = useMemo(() => {
    const cat = CATEGORIES.find((c) => c.id === activeCategory)!;
    return cat;
  }, [activeCategory]);

  // Adjust area if it falls out of category bounds when changing category
  const handleCategoryChange = (catId: string) => {
    const target = CATEGORIES.find((c) => c.id === catId)!;
    setActiveCategory(catId);
    if (area < target.minArea) {
      setArea(target.minArea);
    } else if (area > target.maxArea) {
      setArea(target.maxArea);
    } else {
      // Set to default if area is way off, otherwise keep current to maintain state
      const ratio = (area - category.minArea) / (category.maxArea - category.minArea);
      const newArea = Math.round(target.minArea + ratio * (target.maxArea - target.minArea));
      setArea(Math.max(target.minArea, Math.min(target.maxArea, newArea)));
    }
  };

  // Calculations
  const rate = category.rates[tier];
  const totalCost = area * rate;
  
  // Simulated variance based on quality levels and standard project deviations
  const marginFactor = tier === "basico" ? 0.08 : tier === "estandar" ? 0.12 : 0.15;
  const minCost = Math.round(totalCost * (1 - marginFactor));
  const maxCost = Math.round(totalCost * (1 + marginFactor));

  // Breakdowns
  const breakdown = useMemo(() => {
    const matPercent = tier === "basico" ? 55 : tier === "estandar" ? 50 : 45;
    const laborPercent = tier === "basico" ? 38 : tier === "estandar" ? 43 : 47;
    const escrowPercent = 7; // Fixed escrow/IA runtime fee

    const materiales = Math.round((totalCost * matPercent) / 100);
    const manoObra = Math.round((totalCost * laborPercent) / 100);
    const operativo = Math.round((totalCost * escrowPercent) / 100);

    return {
      materiales,
      manoObra,
      operativo,
      percent: {
        materiales: matPercent,
        manoObra: laborPercent,
        operativo: escrowPercent
      }
    };
  }, [totalCost, tier]);

  return (
    <div className="w-full max-w-6xl mx-auto bg-white/40 dark:bg-slate-900/10 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-6 sm:p-8 md:p-10 backdrop-blur-md shadow-2xl relative overflow-hidden transition-all duration-300">
      
      {/* Background radial glow */}
      <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-blue-500/10 dark:bg-blue-600/5 blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-indigo-500/10 dark:bg-indigo-600/5 blur-[100px] pointer-events-none" />

      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200/50 dark:border-slate-800/50 pb-8 mb-8 relative z-10">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-200 dark:border-blue-900/40 text-xs font-bold text-blue-600 dark:text-blue-400 mb-3 uppercase tracking-wider">
            <Sparkles size={11} className="animate-pulse" />
            Cotizador Inteligente Asistido
          </div>
          <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Calcula el costo estimado de tu obra
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-2xl leading-relaxed">
            Obtén valores de referencia basados en el histórico de transacciones del mercado y la IA de Prometeo. Protege tu presupuesto con contratos claros de escrow.
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-2 text-xs font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-200/40 dark:border-slate-800/40">
          <ShieldCheck size={14} className="text-emerald-500" />
          <span>Fórmula de Escrow Integrado</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 relative z-10 items-start">
        
        {/* Left column - Controls (7 cols) */}
        <div className="lg:col-span-7 space-y-8">
          
          {/* Step 1: Select Category */}
          <div className="space-y-3">
            <label className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              1. Selecciona la categoría del proyecto
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {CATEGORIES.map((cat) => {
                const isSelected = cat.id === activeCategory;
                return (
                  <button
                    key={cat.id}
                    onClick={() => handleCategoryChange(cat.id)}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border text-center transition-all duration-200 focus:outline-none ${
                      isSelected
                        ? "bg-white dark:bg-slate-900 border-blue-500 text-slate-900 dark:text-white shadow-md scale-102 ring-1 ring-blue-500/20"
                        : "bg-white/40 dark:bg-slate-900/10 border-slate-200/50 dark:border-slate-800/40 text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-900/30 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <span className="text-3xl mb-2 filter drop-shadow-sm">{cat.icon}</span>
                    <span className="text-xs font-bold leading-tight">{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Set Area Slider */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                2. Define el tamaño de la superficie
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={area}
                  min={category.minArea}
                  max={category.maxArea}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val)) {
                      setArea(Math.max(category.minArea, Math.min(category.maxArea, val)));
                    }
                  }}
                  className="w-18 text-center text-sm font-black text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg py-1 px-1.5 focus:outline-none focus:border-blue-500"
                />
                <span className="text-xs font-bold text-slate-400 dark:text-slate-500">{category.unit.split(" ")[0]}</span>
              </div>
            </div>

            <div className="bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200/40 dark:border-slate-850 p-6 rounded-2xl space-y-4">
              <div className="flex items-center gap-3">
                <Sliders size={16} className="text-blue-500 shrink-0" />
                <input
                  type="range"
                  min={category.minArea}
                  max={category.maxArea}
                  value={area}
                  onChange={(e) => setArea(parseInt(e.target.value))}
                  className="w-full accent-blue-600 dark:accent-blue-500 cursor-pointer h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none"
                />
              </div>
              <div className="flex justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500">
                <span>Mínimo: {category.minArea} {category.unit.split(" ")[0]}</span>
                <span>Máximo: {category.maxArea} {category.unit.split(" ")[0]}</span>
              </div>
            </div>
          </div>

          {/* Step 3: Choose Quality Tier */}
          <div className="space-y-3">
            <label className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              3. Elige el estándar de acabados
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(["basico", "estandar", "premium"] as const).map((t) => {
                const isSelected = tier === t;
                const titles = {
                  basico: { title: "Básico", desc: "Funcional y económico" },
                  estandar: { title: "Estándar", desc: "Calidad equilibrada" },
                  premium: { title: "Premium", desc: "Alta gama y detalle" }
                };
                const colors = {
                  basico: "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700",
                  estandar: "border-blue-500/50 hover:border-blue-500/70",
                  premium: "border-purple-500/50 hover:border-purple-500/70"
                };
                const activeColors = {
                  basico: "bg-slate-100 dark:bg-slate-900 border-slate-500 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-550/10",
                  estandar: "bg-blue-500/5 dark:bg-blue-950/20 border-blue-500 text-blue-700 dark:text-blue-400 shadow-md ring-1 ring-blue-500/20",
                  premium: "bg-purple-500/5 dark:bg-purple-950/20 border-purple-500 text-purple-700 dark:text-purple-400 shadow-md ring-1 ring-purple-500/20"
                };

                return (
                  <button
                    key={t}
                    onClick={() => setTier(t)}
                    className={`flex flex-col p-4 rounded-xl border text-left transition-all duration-200 focus:outline-none ${
                      isSelected ? activeColors[t] : `bg-white/40 dark:bg-slate-900/10 ${colors[t]} text-slate-500 dark:text-slate-400`
                    }`}
                  >
                    <span className="text-sm font-black tracking-tight">{titles[t].title}</span>
                    <span className="text-[10px] leading-tight text-slate-400 dark:text-slate-500 mt-1">{titles[t].desc}</span>
                    <span className="text-xs font-black mt-2 inline-block">
                      ${category.rates[t]} MXN <span className="text-[9px] font-medium text-slate-400">/ m²</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Right column - Summary & Output (5 cols) */}
        <div className="lg:col-span-5 space-y-6 bg-slate-50/50 dark:bg-slate-950/40 border border-slate-200/50 dark:border-slate-850 p-6 sm:p-8 rounded-3xl relative">
          
          <div className="absolute top-4 right-4 pointer-events-none">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
          </div>

          <div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest block">
              Estimación de Rango Total
            </span>
            <div className="mt-2 flex items-baseline gap-1.5 flex-wrap">
              <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white">
                ${minCost.toLocaleString("es-MX")}
              </span>
              <span className="text-sm font-bold text-slate-400 dark:text-slate-500">—</span>
              <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white">
                ${maxCost.toLocaleString("es-MX")}
              </span>
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 ml-1">
                MXN
              </span>
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 leading-relaxed flex items-center gap-1">
              <AlertCircle size={10} className="text-slate-400 inline shrink-0" />
              <span>Costo medio de referencia: <strong>${totalCost.toLocaleString("es-MX")} MXN</strong> para {area} {category.unit.split(" ")[0]}.</span>
            </p>
          </div>

          {/* Breakdown progress bars */}
          <div className="space-y-4 border-t border-b border-slate-200/50 dark:border-slate-800/50 py-5">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest block">
              Desglose Operativo Sugerido
            </span>

            {/* Materiales */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-355">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                  Materiales ({breakdown.percent.materiales}%)
                </span>
                <span>${breakdown.materiales.toLocaleString("es-MX")} MXN</span>
              </div>
              <div className="w-full h-1.5 bg-slate-250 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                  style={{ width: `${breakdown.percent.materiales}%` }}
                />
              </div>
            </div>

            {/* Mano de Obra */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-355">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Mano de Obra ({breakdown.percent.manoObra}%)
                </span>
                <span>${breakdown.manoObra.toLocaleString("es-MX")} MXN</span>
              </div>
              <div className="w-full h-1.5 bg-slate-250 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${breakdown.percent.manoObra}%` }}
                />
              </div>
            </div>

            {/* Capa Operativa Escrow/IA */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-slate-355">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                  Seguridad & IA Escrow ({breakdown.percent.operativo}%)
                </span>
                <span>${breakdown.operativo.toLocaleString("es-MX")} MXN</span>
              </div>
              <div className="w-full h-1.5 bg-slate-250 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all duration-300"
                  style={{ width: `${breakdown.percent.operativo}%` }}
                />
              </div>
            </div>
          </div>

          {/* Checklist description */}
          <div className="space-y-3">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest block">
              Qué incluye esta estimación
            </span>
            <div className="max-h-[160px] overflow-y-auto pr-1 space-y-2.5 custom-scrollbar">
              {category.features[tier].map((feat, i) => (
                <div key={i} className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-400">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Check size={10} className="stroke-[3]" />
                  </div>
                  <span className="leading-tight">{feat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* CTA Link to wizard */}
          <Link
            href={`/client/jobs/new?category=${category.id}&area=${area}&tier=${tier}`}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/10 hover:shadow-lg hover:shadow-blue-500/20 active:scale-98 transition-all duration-200 no-underline"
          >
            Publicar con esta estimación
            <ArrowRight size={14} />
          </Link>
          
        </div>

      </div>
    </div>
  );
}
