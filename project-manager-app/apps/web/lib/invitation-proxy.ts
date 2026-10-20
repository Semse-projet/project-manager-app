import { signInvitationProxy } from "@semse/auth/invitation-proxy";
import type { NextRequest } from "next/server";

/** Opt in only after verifying the Railway edge overwrites X-Real-IP. */
export function invitationProxyHeaders(request: NextRequest, apiPath: string): Record<string, string> {
  const key = process.env.SEMSE_INVITATION_PROXY_KEY ?? "";
  if (process.env.NODE_ENV !== "production" && key.length < 32) return {};
  if (process.env.SEMSE_INVITATION_TRUST_RAILWAY_EDGE !== "true" || !process.env.RAILWAY_ENVIRONMENT_ID) {
    throw new Error("Invitation ingress is not verified");
  }
  return signInvitationProxy(key, request.headers.get("x-real-ip") ?? "", request.method, apiPath);
}
