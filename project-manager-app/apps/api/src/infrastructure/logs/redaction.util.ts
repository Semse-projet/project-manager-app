/**
 * Log Redaction Utility
 *
 * Sanitizes log messages before display to prevent exposing sensitive information.
 * Used by Observer, ConsciousnessIndex, and other systems that expose logs in UI.
 *
 * Policy: Redact first, show safe diagnostic messages.
 */

const SECRET_PATTERNS = [
  // Bearer tokens
  /Bearer\s+[A-Za-z0-9._\-]+/gi,
  // OpenAI keys (sk-*)
  /sk-[A-Za-z0-9_\-]+/gi,
  // Stripe webhook secrets
  /whsec_[A-Za-z0-9_\-]+/gi,
  // Slack tokens
  /xox[baprs]-[A-Za-z0-9\-]+/gi,
  // PostgreSQL URLs
  /postgres:\/\/[^\s"']+/gi,
  // MySQL URLs
  /mysql:\/\/[^\s"']+/gi,
  // MongoDB URLs
  /mongodb:\/\/[^\s"']+/gi,
  // Redis URLs
  /redis:\/\/[^\s"']+/gi,
  // Database credentials in URL
  /\w+:\/\/[^:]+:[^@]+@/gi,
  // Environment variables with secrets
  /DATABASE_URL=([^\s"']+)/gi,
  /REDIS_URL=([^\s"']+)/gi,
  /API_KEY=([^\s"']+)/gi,
  /SECRET=([^\s"']+)/gi,
  // Authorization headers
  /Authorization:\s*[^\n\r]+/gi,
  // Cookie headers
  /Cookie:\s*[^\n\r]+/gi,
  /Set-Cookie:\s*[^\n\r]+/gi,
  // JWT tokens
  /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  // Generic token/secret patterns
  /["']?access_token["']?\s*[:=]\s*["'][^"']+["']/gi,
  /["']?refresh_token["']?\s*[:=]\s*["'][^"']+["']/gi,
  /["']?api_key["']?\s*[:=]\s*["'][^"']+["']/gi,
  /["']?secret_key["']?\s*[:=]\s*["'][^"']+["']/gi,
];

/**
 * Redact sensitive information from a log message.
 *
 * Safe to call on any user-facing log output. Will replace all
 * known secret patterns with [REDACTED].
 *
 * @param message - Raw log message
 * @returns Sanitized message safe for UI display
 */
export function redactSensitiveLog(message: string): string {
  let result = message;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, "[REDACTED]");
  }
  return result;
}

/**
 * Safely extract a diagnostic message from a larger log output.
 *
 * Keeps only useful diagnostic info, redacts secrets.
 *
 * @param fullMessage - Complete log message
 * @param maxLength - Max length for output (default 500)
 * @returns Safe diagnostic message
 */
export function extractSafeDiagnostic(fullMessage: string, maxLength = 500): string {
  const redacted = redactSensitiveLog(fullMessage);
  if (redacted.length <= maxLength) {
    return redacted;
  }
  return redacted.substring(0, maxLength) + "...";
}

/**
 * Check if a message contains secrets before logging to external systems.
 *
 * @param message - Message to check
 * @returns true if secrets detected
 */
export function containsSecrets(message: string): boolean {
  return SECRET_PATTERNS.some((pattern) => pattern.test(message));
}
