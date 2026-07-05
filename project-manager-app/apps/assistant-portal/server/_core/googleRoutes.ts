/**
 * Google OAuth routes for account linking.
 * Handles the OAuth callback to connect a user's Google account.
 */

import type { Express, Request, Response } from "express";
import { ENV } from "./env";
import { connectGoogle } from "./google";

/**
 * Registers Google-specific routes on the Express app.
 * - GET /api/google/connect: Redirects user to Google OAuth consent screen.
 * - GET /api/google/callback: Handles the OAuth callback and links the account.
 */
export function registerGoogleRoutes(app: Express): void {
  // Only register routes if Google credentials are configured
  if (!ENV.googleClientId || !ENV.googleClientSecret) {
    console.log("[Google] Credentials not configured, skipping route registration.");
    return;
  }

  app.get("/api/google/connect", (_req: Request, res: Response) => {
    const params = new URLSearchParams({
      client_id: ENV.googleClientId,
      redirect_uri: ENV.googleRedirectUri,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "consent",
    });
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  });

  app.get("/api/google/callback", async (req: Request, res: Response) => {
    const code = req.query.code as string | undefined;

    if (!code) {
      return res.status(400).json({ error: "Missing authorization code" });
    }

    try {
      // Exchange code for tokens
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: ENV.googleClientId,
          client_secret: ENV.googleClientSecret,
          redirect_uri: ENV.googleRedirectUri,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenResponse.ok) {
        console.error("[Google] Token exchange failed:", await tokenResponse.text());
        return res.status(500).json({ error: "Failed to exchange authorization code" });
      }

      const tokens = (await tokenResponse.json()) as { access_token: string };

      // Get user info
      const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      if (!userInfoResponse.ok) {
        return res.status(500).json({ error: "Failed to fetch user info" });
      }

      const userInfo = (await userInfoResponse.json()) as { email: string };

      // TODO: Extract authenticated userId from session/cookie
      // For now, this is a placeholder that should be connected to the auth context
      const userId = 1;
      connectGoogle(userId, userInfo.email);

      // Redirect back to settings page
      const origin = req.headers.origin || req.headers.referer || "/";
      res.redirect(`${origin}/settings?google=connected`);
    } catch (error) {
      console.error("[Google] OAuth callback error:", error);
      res.status(500).json({ error: "Internal server error during Google OAuth" });
    }
  });
}
