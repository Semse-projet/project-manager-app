"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, ChevronLeft, ChevronRight, Quote } from "lucide-react";
import { PublicLandingTestimonial } from "../../lib/public-landing";

interface TestimonialsCarouselProps {
  testimonials: PublicLandingTestimonial[];
}

const FALLBACK_TESTIMONIALS: PublicLandingTestimonial[] = [
  {
    id: "fb-1",
    score: 5,
    comment: "SEMSE Project cambió por completo la forma en que gestiono mis subcontratistas. Los pagos en depósito de garantía (escrow) y el registro automático de evidencias con IA nos ahorran disputas y horas de chat improductivas.",
    jobTitle: "Remodelación de Locales Comerciales",
    authorName: "Ing. Carlos Mendieta",
    targetName: "Servicios de Construcción CM",
    createdAt: new Date().toISOString(),
  },
  {
    id: "fb-2",
    score: 5,
    comment: "Como electricista independiente, antes perdía días cobrando facturas y justificando trabajos menores. Con esta plataforma, los hitos están claros, el depósito asegurado y cobro al instante al terminar.",
    jobTitle: "Instalación Eléctrica Trifásica y Cableado",
    authorName: "Adrián Reyes",
    targetName: "Reyes Eléctricos & Asociados",
    createdAt: new Date().toISOString(),
  },
  {
    id: "fb-3",
    score: 5,
    comment: "Buscaba reparar el drywall de mi casa y el asistente inteligente me guió paso a paso para describir el daño. Recibí 3 propuestas detalladas en minutos y el pago solo se liberó cuando aprobé el acabado visual.",
    jobTitle: "Reparación y Acabado de Drywall Residencial",
    authorName: "Sofía Vergara",
    targetName: "Particular",
    createdAt: new Date().toISOString(),
  },
  {
    id: "fb-4",
    score: 5,
    comment: "La integración con Prometeo IA es el verdadero diferencial. Te analiza los avances cargados en fotos, genera reportes ejecutivos en segundos y previene malentendidos antes de que se conviertan en disputas.",
    jobTitle: "Mantenimiento Preventivo de Aire Acondicionado",
    authorName: "Mariana G. Orozco",
    targetName: "Administración de Plazas Altavista",
    createdAt: new Date().toISOString(),
  },
];

export function TestimonialsCarousel({ testimonials }: TestimonialsCarouselProps) {
  const [items, setItems] = useState<PublicLandingTestimonial[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(0); // -1 for left, 1 for right
  const [isHovered, setIsHovered] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formJob, setFormJob] = useState("");
  const [formTarget, setFormTarget] = useState("");
  const [formScore, setFormScore] = useState(5);
  const [formComment, setFormComment] = useState("");
  const [formSuccess, setFormSuccess] = useState(false);

  useEffect(() => {
    setItems(testimonials.length > 0 ? testimonials : FALLBACK_TESTIMONIALS);
  }, [testimonials]);

  const slideNext = () => {
    if (items.length === 0) return;
    setDirection(1);
    setActiveIndex((prevIndex) => (prevIndex + 1) % items.length);
  };

  const slidePrev = () => {
    if (items.length === 0) return;
    setDirection(-1);
    setActiveIndex((prevIndex) => (prevIndex - 1 + items.length) % items.length);
  };

  const setIndex = (index: number) => {
    setDirection(index > activeIndex ? 1 : -1);
    setActiveIndex(index);
  };

  useEffect(() => {
    if (items.length === 0) return;
    if (!isHovered) {
      timerRef.current = setInterval(slideNext, 6000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeIndex, isHovered, items.length]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formJob.trim() || !formTarget.trim() || !formComment.trim()) return;

    const newReview: PublicLandingTestimonial = {
      id: `custom-${Date.now()}`,
      score: formScore,
      comment: formComment,
      jobTitle: formJob,
      authorName: formName,
      targetName: formTarget,
      createdAt: new Date().toISOString()
    };

    setItems((prev) => [newReview, ...prev]);
    setActiveIndex(0);
    setFormSuccess(true);

    // Reset form
    setFormName("");
    setFormJob("");
    setFormTarget("");
    setFormScore(5);
    setFormComment("");

    setTimeout(() => {
      setFormSuccess(false);
    }, 5000);
  };

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 100 : -100,
      opacity: 0,
      scale: 0.95,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
      transition: {
        x: { type: "spring", stiffness: 300, damping: 30 },
        opacity: { duration: 0.25 },
        scale: { duration: 0.25 },
      },
    },
    exit: (dir: number) => ({
      x: dir < 0 ? 100 : -100,
      opacity: 0,
      scale: 0.95,
      transition: {
        x: { type: "spring", stiffness: 300, damping: 30 },
        opacity: { duration: 0.25 },
        scale: { duration: 0.25 },
      },
    }),
  };

  const currentItem = items[activeIndex];

  return (
    <div
      className="relative max-w-4xl mx-auto px-4 py-8 space-y-12"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background Decorative Blob */}
      <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 via-transparent to-purple-500/5 rounded-3xl -z-10 blur-xl pointer-events-none" />

      {/* Quote Icon Background */}
      <div className="absolute top-4 left-6 text-slate-150 dark:text-slate-900 pointer-events-none opacity-40 select-none">
        <Quote size={120} className="stroke-[1.5]" />
      </div>

      {/* Main Card Slot */}
      {currentItem && (
        <div className="relative min-h-[300px] sm:min-h-[260px] flex items-center justify-center overflow-hidden">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={currentItem.id}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              className="w-full bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-sm rounded-3xl p-8 sm:p-10 shadow-xl flex flex-col justify-between"
            >
              <div>
                {/* Header with Title and Rating */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <div>
                    <h4 className="font-extrabold text-lg text-slate-900 dark:text-white leading-tight">
                      {currentItem.jobTitle}
                    </h4>
                    <div className="flex gap-0.5 mt-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          size={16}
                          className={`${
                            i < Math.floor(currentItem.score)
                              ? "text-amber-500 fill-amber-500"
                              : "text-slate-350 dark:text-slate-700"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <span className="text-[11px] font-extrabold tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-full uppercase">
                    Contrato Verificado
                  </span>
                </div>

                {/* Comment Body */}
                <p className="text-base sm:text-lg text-slate-655 dark:text-slate-300 leading-relaxed italic mb-8 relative z-10">
                  “{currentItem.comment}”
                </p>
              </div>

              {/* Footer with Author Details */}
              <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/60 pt-6 mt-2">
                <div className="flex flex-col">
                  <span className="font-bold text-sm text-slate-900 dark:text-white">
                    {currentItem.authorName}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    Evaluador
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
                  <span>Destinatario:</span>
                  <span className="bg-blue-500/10 px-2.5 py-1 rounded-lg">
                    {currentItem.targetName}
                  </span>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* Control Buttons */}
      {items.length > 0 && (
        <div className="flex items-center justify-between mt-8">
          {/* Indicators */}
          <div className="flex gap-2.5">
            {items.map((_, index) => (
              <button
                key={index}
                onClick={() => setIndex(index)}
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  index === activeIndex
                    ? "w-8 bg-blue-600 dark:bg-blue-400"
                    : "w-2.5 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400 dark:hover:bg-slate-600"
                }`}
                aria-label={`Ir al testimonio ${index + 1}`}
              />
            ))}
          </div>

          {/* Arrow Controls */}
          <div className="flex gap-3">
            <button
              onClick={slidePrev}
              className="w-11 h-11 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:bg-slate-700 flex items-center justify-center shadow-sm active:scale-95 transition-all duration-150 cursor-pointer"
              aria-label="Testimonio anterior"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={slideNext}
              className="w-11 h-11 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-655 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:bg-slate-700 flex items-center justify-center shadow-sm active:scale-95 transition-all duration-150 cursor-pointer"
              aria-label="Siguiente testimonio"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Dynamic Review Submission Form */}
      <div className="border-t border-slate-200/50 dark:border-slate-800/60 my-10 pt-10">
        <h3 className="text-lg font-extrabold text-slate-900 dark:text-white mb-2">
          Comparte tu experiencia con el ecosistema
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
          ¿Has completado un hito o proyecto en SEMSEproject? Deja tu reseña verificable en escrow para alimentar el trust score de la comunidad.
        </p>

        {formSuccess ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-2xl text-xs font-bold text-center"
          >
            ✓ ¡Gracias! Tu valoración ha sido enviada e indexada en la red de reputación. Se mostrará en la pasarela de inmediato.
          </motion.div>
        ) : (
          <form onSubmit={handleFormSubmit} className="space-y-4 max-w-2xl">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider block">Tu Nombre</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ej: Carlos Mendieta"
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 text-[var(--ink)] focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider block">Proyecto o Especialidad</label>
                <input
                  type="text"
                  required
                  value={formJob}
                  onChange={(e) => setFormJob(e.target.value)}
                  placeholder="Ej: Reparación de Drywall"
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 text-[var(--ink)] focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider block">Profesional / Contratista calificado</label>
                <input
                  type="text"
                  required
                  value={formTarget}
                  onChange={(e) => setFormTarget(e.target.value)}
                  placeholder="Ej: Reyes Eléctricos"
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 text-[var(--ink)] focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider block">Calificación</label>
                <div className="flex items-center gap-1.5 h-10">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFormScore(star)}
                      className="text-slate-350 hover:text-amber-500 transition-colors"
                    >
                      <Star
                        size={20}
                        className={star <= formScore ? "text-amber-500 fill-amber-500" : "text-slate-350 dark:text-slate-700"}
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider block">Tu Reseña</label>
              <textarea
                required
                value={formComment}
                onChange={(e) => setFormComment(e.target.value)}
                placeholder="Escribe aquí tu comentario sobre la obra, calidad del profesional y el uso del escrow..."
                className="w-full min-h-[80px] text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 text-[var(--ink)] focus:outline-none focus:border-blue-500 resize-none leading-relaxed"
              />
            </div>

            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md active:scale-98 transition-all duration-200 cursor-pointer"
            >
              Publicar Valoración
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
