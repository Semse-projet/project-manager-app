import {
  generalizePublicLocation,
  publicDisplayName,
  redactPublicText,
} from "@semse/schemas";

export type PublicLandingProfessional = {
  id: string;
  displayName: string;
  completedProjects: number;
  avgClientRating: number;
  trustScore: number;
  specialties: string[];
  badges: string[];
  publicSlug: string | null;
  verifiedAt: string | null;
};

export type PublicLandingTestimonial = {
  id: string;
  score: number;
  comment: string;
  jobTitle: string;
  authorName: string;
  targetName: string;
  createdAt: string;
};

export type PublicLandingFeaturedJob = {
  id: string;
  title: string;
  category: string | null;
  scope: string;
  status: string;
  budgetMin: number | null;
  budgetMax: number | null;
  location: string | null;
  urgency: string | null;
};

export type PublicLandingOverview = {
  tenantId: string;
  stats: {
    activeJobs: number;
    verifiedProfessionals: number;
    completedProjects: number;
    averageRating: number;
  };
  topProfessionals: PublicLandingProfessional[];
  testimonials: PublicLandingTestimonial[];
  featuredJobs: PublicLandingFeaturedJob[];
  generatedAt: string;
};

const FALLBACK_OVERVIEW: PublicLandingOverview = {
  tenantId: "tenant_default",
  stats: {
    activeJobs: 0,
    verifiedProfessionals: 0,
    completedProjects: 0,
    averageRating: 0,
  },
  topProfessionals: [],
  testimonials: [],
  featuredJobs: [],
  generatedAt: new Date(0).toISOString(),
};

/**
 * Defensa en profundidad: el API ya sanitiza estos campos antes de
 * serializar, pero esta capa re-aplica el mismo contrato para que un API
 * desactualizado, un fallback o un dato legado nunca metan PII en el HTML
 * inicial del SSR.
 */
export function sanitizePublicOverview(overview: PublicLandingOverview): PublicLandingOverview {
  return {
    ...overview,
    topProfessionals: overview.topProfessionals.map((pro) => ({
      ...pro,
      displayName: publicDisplayName(pro.displayName, "Profesional verificado"),
    })),
    testimonials: overview.testimonials.map((testimonial) => ({
      ...testimonial,
      comment: redactPublicText(testimonial.comment, 400),
      jobTitle: redactPublicText(testimonial.jobTitle, 120),
      authorName: publicDisplayName(testimonial.authorName, "Cliente verificado"),
      targetName: publicDisplayName(testimonial.targetName, "Profesional verificado"),
    })),
    featuredJobs: overview.featuredJobs.map((job) => ({
      ...job,
      title: redactPublicText(job.title, 120),
      scope: redactPublicText(job.scope, 280),
      location: generalizePublicLocation(job.location),
    })),
  };
}

export async function fetchPublicLandingOverviewServer(): Promise<PublicLandingOverview> {
  const apiBase = process.env.SEMSE_API_BASE_URL ?? "http://127.0.0.1:4000";

  try {
    const response = await fetch(`${apiBase}/v1/intelligence/public/overview?limit=4`, {
      cache: "no-store",
      headers: { "x-tenant-id": process.env.SEMSE_TENANT_ID ?? "tenant_default" },
    });

    if (!response.ok) {
      return FALLBACK_OVERVIEW;
    }

    const json = (await response.json()) as { data?: PublicLandingOverview };
    return sanitizePublicOverview(json.data ?? FALLBACK_OVERVIEW);
  } catch {
    return FALLBACK_OVERVIEW;
  }
}
