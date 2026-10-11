/**
 * Public landing statistics, derived only from what the API's own @Public
 * `GET /v1/intelligence/public/overview` endpoint reports. Nothing here is a
 * default or a placeholder: a value the API did not report stays `null` so the
 * caller can omit it instead of showing an invented number.
 */
export type PublicStats = {
  activeJobs: number | null;
  verifiedProfessionals: number | null;
  completedProjects: number | null;
  /** Average rating on a 0-5 scale, one decimal. */
  averageRating: number | null;
};

function toCount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
}

function toRating(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 5) return null;
  return Math.round(value * 10) / 10;
}

/**
 * Maps the `data` payload of the public overview endpoint to PublicStats.
 * Returns `null` when the payload has no usable `stats` object at all, so the
 * route can answer with an error rather than a fabricated all-zero result.
 */
export function toPublicStats(overview: unknown): PublicStats | null {
  if (typeof overview !== "object" || overview === null) return null;
  const stats = (overview as { stats?: unknown }).stats;
  if (typeof stats !== "object" || stats === null) return null;

  const record = stats as Record<string, unknown>;
  return {
    activeJobs: toCount(record.activeJobs),
    verifiedProfessionals: toCount(record.verifiedProfessionals),
    completedProjects: toCount(record.completedProjects),
    averageRating: toRating(record.averageRating),
  };
}
