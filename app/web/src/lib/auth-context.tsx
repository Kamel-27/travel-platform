"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, ApiError } from "./api-client";
import { setAccessToken } from "./token-store";
import type { SessionResponse, SessionUser } from "./types";

interface AuthContextValue {
  user: SessionUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (session: SessionResponse) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // The access token lives in memory only, so it's gone on every reload.
    // Recover the session from the httpOnly refresh cookie, then hydrate
    // the user from /me. Both failing just means "logged out".
    (async () => {
      try {
        const session = await api.post<SessionResponse>("/auth/refresh", undefined, {
          skipAuthRetry: true,
          skipAuth: true,
        });
        setAccessToken(session.access_token);
        setUser(session.user);
      } catch {
        setAccessToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback((session: SessionResponse) => {
    setAccessToken(session.access_token);
    setUser(session.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      // Best-effort — a failed revoke server-side shouldn't block clearing
      // the local session (ApiError here just means we're already logged out).
      if (!(err instanceof ApiError)) throw err;
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
