import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { hasSession } from "../api/client";
import { fetchMe, login as apiLogin, logout as apiLogout } from "../api/auth";
import {
  registerForPushNotificationsAsync,
  unregisterPushNotificationsAsync,
} from "../notifications/pushRegistration";

type AuthIdentity = {
  userId: string;
  tenantId: string;
  orgId: string;
  roles: string[];
};

type AuthContextValue = {
  loading: boolean;
  isAuthenticated: boolean;
  userId: string | null;
  tenantId: string | null;
  orgId: string | null;
  roles: string[];
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const EMPTY_IDENTITY: AuthIdentity = { userId: "", tenantId: "", orgId: "", roles: [] };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [identity, setIdentity] = useState<AuthIdentity>(EMPTY_IDENTITY);

  useEffect(() => {
    void (async () => {
      const has = await hasSession();
      if (!has) {
        setLoading(false);
        return;
      }
      // On app-start session restore, a failed /v1/auth/me just means "not
      // authenticated" — silently fall back to the login screen.
      await hydrateIdentity().catch(() => undefined);
      setLoading(false);
    })();
  }, []);

  /**
   * Fetches roles/tenant/org via GET /v1/auth/me. Throws on failure so
   * callers (login()) can surface the real reason instead of silently
   * leaving the user stuck on the login screen with no feedback — this
   * used to swallow the error entirely, which made a working POST
   * /v1/auth/login followed by a failing /v1/auth/me look exactly like a
   * dead login button with no error message.
   */
  async function hydrateIdentity(): Promise<void> {
    try {
      const me = await fetchMe();
      setIdentity({ userId: me.userId, tenantId: me.tenantId, orgId: me.orgId, roles: me.roles });
      setIsAuthenticated(true);
      // Best-effort — a push registration failure must never block login/session restore.
      void registerForPushNotificationsAsync().catch((error) =>
        console.warn("[push] registration failed", error),
      );
    } catch (error) {
      setIdentity(EMPTY_IDENTITY);
      setIsAuthenticated(false);
      throw error;
    }
  }

  async function login(email: string, password: string): Promise<void> {
    await apiLogin(email, password);
    await hydrateIdentity();
  }

  async function logout(): Promise<void> {
    await unregisterPushNotificationsAsync().catch(() => undefined);
    await apiLogout();
    setIdentity(EMPTY_IDENTITY);
    setIsAuthenticated(false);
  }

  return (
    <AuthContext.Provider
      value={{
        loading,
        isAuthenticated,
        userId: isAuthenticated ? identity.userId : null,
        tenantId: isAuthenticated ? identity.tenantId : null,
        orgId: isAuthenticated ? identity.orgId : null,
        roles: identity.roles,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
