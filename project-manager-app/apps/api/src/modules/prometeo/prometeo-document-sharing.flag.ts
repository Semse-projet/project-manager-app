/** Deployment-gated sharing: default false unless explicitly operator-enabled.
 * Revocation intentionally stays available while OFF for incident cleanup.
 */
export const PROMETEO_DOCUMENT_SHARING_FLAG = "SEMSE_PROMETEO_DOCUMENT_SHARING_ENABLED";
export function isPrometeoDocumentSharingEnabled(): boolean {
  return process.env.SEMSE_PROMETEO_DOCUMENT_SHARING_ENABLED === "true";
}
