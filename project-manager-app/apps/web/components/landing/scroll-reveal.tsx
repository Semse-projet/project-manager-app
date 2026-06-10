"use client";

import React, { ReactNode } from "react";
import { motion } from "framer-motion";

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
}

export function ScrollReveal({ children, className = "", delay = 0, duration = 0.5 }: ScrollRevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{
        duration: duration,
        delay: delay,
        ease: [0.16, 1, 0.3, 1], // easeOutExpo
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
