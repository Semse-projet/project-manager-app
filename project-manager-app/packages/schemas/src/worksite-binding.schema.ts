import { z } from "zod";

/**
 * OPEN-18 — contratos públicos de ubicación de obra, vínculos obra ↔ Job/proyecto libre y
 * sitios detectables. Spec: docs/specs/core/worksite-location-binding.spec.md
 * La persistencia (WorksiteBinding, columnas de Worksite) vive en packages/db; aquí solo
 * lo que cruza la API.
 */

export const siteKindSchema = z.enum(["JOB", "FREE_PROJECT"]);
export type SiteKind = z.infer<typeof siteKindSchema>;

const idSchema = z.string().trim().min(1).max(64);

/** Sitio detectado por el cliente en un evento de geocerca. */
export const siteRefSchema = z.object({ kind: siteKindSchema, id: idSchema });
export type SiteRef = z.infer<typeof siteRefSchema>;

/** Solo `manual_pin` y `onsite_capture` cuentan como ubicación verificada. */
export const worksiteLocationSourceSchema = z.enum(["manual_pin", "onsite_capture", "geocoded"]);
export type WorksiteLocationSource = z.infer<typeof worksiteLocationSourceSchema>;

/** Q2 (aprobada 2026-11-20): radio de 50–1000 m; 150 m por defecto. */
export const WORKSITE_RADIUS_METERS = { min: 50, max: 1000, default: 150 } as const;

export const worksiteLocationInputSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().int().min(WORKSITE_RADIUS_METERS.min).max(WORKSITE_RADIUS_METERS.max).optional(),
  source: worksiteLocationSourceSchema
});
export type WorksiteLocationInput = z.infer<typeof worksiteLocationInputSchema>;

export const worksiteBindingInputSchema = z.object({ kind: siteKindSchema, targetId: idSchema });
export type WorksiteBindingInput = z.infer<typeof worksiteBindingInputSchema>;

export type WorksiteLocationView = {
  worksiteId: string;
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number | null;
  source: WorksiteLocationSource | null;
  verified: boolean;
  verifiedAt: string | Date | null;
};

export type WorksiteBindingView = {
  bindingId: string;
  worksiteId: string;
  kind: SiteKind;
  targetId: string | null;
  status: "ACTIVE" | "ENDED";
  createdBy: string;
  createdAt: string | Date;
  endedAt: string | Date | null;
};

/** `GET /v1/me/geofence-sites`: ubicación y radio de la OBRA, nunca de la persona. */
export type GeofenceSiteView = {
  kind: SiteKind;
  targetId: string;
  worksiteId: string;
  worksiteName: string;
  latitude: number;
  longitude: number;
  radiusMeters: number | null;
  verified: boolean;
};
