import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ApiError, hasSession, subscribeSessionExpired } from "../api/client";
import { stopProximityTracking } from "../geo/backgroundLocation";
import { saveSites, saveProximityMode } from "../geo/siteCache";
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
  sessionError: string | null;
  retrySession: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const EMPTY_IDENTITY: AuthIdentity = { userId: "", tenantId: "", orgId: "", roles: [] };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [identity, setIdentity] = useState<AuthIdentity>(EMPTY_IDENTITY);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const sessionEpoch = useRef(0);

  async function stopSessionTracking(): Promise<void> {
    await Promise.allSettled([stopProximityTracking(), saveSites([]), saveProximityMode("off")]);
  }

  async function restoreSession(): Promise<void> {
    setLoading(true);
    setSessionError(null);
    try {
      if (await hasSession()) await hydrateIdentity();
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) {
        setSessionError(error instanceof Error ? error.message : "No se pudo recuperar tu sesión.");
      }
    } finally { setLoading(false); }
  }

  useEffect(() => {
    const unsubscribe = subscribeSessionExpired(() => {
      sessionEpoch.current += 1;
      setIdentity(EMPTY_IDENTITY);
      setIsAuthenticated(false);
      setSessionError(null);
      void stopSessionTracking();
    });
    void restoreSession();
    return () => { sessionEpoch.current += 1; unsubscribe(); };
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
    const epoch = sessionEpoch.current;
    try {
      const me = await fetchMe();
      if (epoch !== sessionEpoch.current) return;
      setIdentity({ userId: me.userId, tenantId: me.tenantId, orgId: me.orgId, roles: me.roles });
      setIsAuthenticated(true);
      // Best-effort — a push registration failure must never block login/session restore.
      void registerForPushNotificationsAsync().catch((error) =>
        console.warn("[push] registration failed", error),
      );
    } catch (error) {
      if (epoch !== sessionEpoch.current) throw error;
      setIdentity(EMPTY_IDENTITY);
      setIsAuthenticated(false);
      throw error;
    }
  }

  async function login(email: string, password: string): Promise<void> {
    sessionEpoch.current += 1;
    setSessionError(null);
    await apiLogin(email, password);
    await hydrateIdentity();
  }

  async function logout(): Promise<void> {
    sessionEpoch.current += 1;
    setLoading(true);
    setIdentity(EMPTY_IDENTITY);
    setIsAuthenticated(false);
    setSessionError(null);
    await stopSessionTracking();
    await unregisterPushNotificationsAsync().catch(() => undefined);
    try { await apiLogout().catch(() => undefined); }
    finally { setLoading(false); }
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
        sessionError,
        retrySession: restoreSession,
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
