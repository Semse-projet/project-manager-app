import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { hasSession } from "../api/client";
import { login as apiLogin, logout as apiLogout } from "../api/auth";

type AuthContextValue = {
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    void hasSession().then((has) => {
      setIsAuthenticated(has);
      setLoading(false);
    });
  }, []);

  async function login(email: string, password: string): Promise<void> {
    await apiLogin(email, password);
    setIsAuthenticated(true);
  }

  async function logout(): Promise<void> {
    await apiLogout();
    setIsAuthenticated(false);
  }

  return (
    <AuthContext.Provider value={{ loading, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
