"use client";

import nextDynamic from "next/dynamic";

const SemseControlSurface = nextDynamic(
  () => import("./semse-control-surface").then((module) => module.SemseControlSurface),
  {
    ssr: false,
    loading: () => null
  }
);

export function SemseControlSurfaceClient() {
  return <SemseControlSurface />;
}
