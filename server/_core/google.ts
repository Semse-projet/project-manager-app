/**
 * Google integration status and management.
 * Provides helpers to check and disconnect Google account linkage per user.
 */

// In-memory store for Google connection status (replace with DB when available)
const googleConnections = new Map<number, { connected: boolean; email?: string }>();

export interface GoogleStatus {
  connected: boolean;
  configured: boolean;
  email?: string;
}

/**
 * Returns the Google connection status for a given user.
 */
export async function getGoogleStatus(userId: number): Promise<GoogleStatus> {
  const { ENV } = await import("./env");
  const configured = !!(ENV.googleClientId && ENV.googleClientSecret);
  const connection = googleConnections.get(userId);
  return {
    connected: connection?.connected ?? false,
    configured,
    email: connection?.email,
  };
}

/**
 * Disconnects the Google account for a given user.
 */
export function disconnectGoogle(userId: number): void {
  googleConnections.delete(userId);
}

/**
 * Connects a Google account for a given user (called after OAuth callback).
 */
export function connectGoogle(userId: number, email: string): void {
  googleConnections.set(userId, { connected: true, email });
}
