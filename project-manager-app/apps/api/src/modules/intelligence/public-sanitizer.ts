/**
 * La implementación canónica vive en @semse/schemas (public-sanitizer.ts)
 * para que API y web apliquen exactamente el mismo contrato de privacidad
 * pública. Este archivo se conserva como punto de import estable del API.
 */
export {
  generalizePublicLocation,
  publicDisplayName,
  redactPublicText,
} from "@semse/schemas";
