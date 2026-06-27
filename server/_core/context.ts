import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { ENV } from "./env";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  // Local fallback so the app remains navigable without a configured OAuth server.
  // SECURITY: Only enabled in development mode to prevent accidental production bypass.
  if (!user && !ENV.oAuthServerUrl && !ENV.isProduction) {
    user = {
      id: 1,
      openId: "local-dev-user",
      name: "Local Dev User",
      email: "local@example.com",
      loginMethod: "local-dev",
      role: "user", // Use 'user' role by default, not 'admin'
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
