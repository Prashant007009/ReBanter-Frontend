import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiFetch, rawFetch } from "@/api/client";
import { getAccessToken, setTokens, clearTokens } from "./tokenStore";

export interface MeProfile {
  id: string;
  handle: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  link: string | null;
  isPrivate: boolean;
  whoCanBanter: "CREW_ONLY" | "EVERYONE";
  windDownAfterMin: number | null;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  stats: { drops: number; crew: number };
}

interface AuthResponse {
  user: Pick<MeProfile, "id" | "handle" | "displayName" | "avatarUrl">;
  accessToken: string;
  refreshToken: string;
}

interface SessionState {
  user: MeProfile | null;
  isLoading: boolean;
  signIn: (handle: string, password: string) => Promise<void>;
  signUp: (handle: string, displayName: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const SessionContext = createContext<SessionState | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<MeProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadMe = useCallback(async () => {
    const me = await apiFetch<MeProfile>("/api/users/me");
    setUser(me);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        await loadMe();
      } catch {
        // No token, invalid token, refresh failed, or storage unavailable —
        // any of these just means "stay signed out," never "hang forever."
      } finally {
        setIsLoading(false);
      }
    })();
  }, [loadMe]);

  const signIn = useCallback(async (handle: string, password: string) => {
    const res = await rawFetch<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ handle, password }),
    });
    await setTokens(res.accessToken, res.refreshToken);
    await loadMe();
  }, [loadMe]);

  const signUp = useCallback(async (handle: string, displayName: string, password: string) => {
    const res = await rawFetch<AuthResponse>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ handle, displayName, password }),
    });
    await setTokens(res.accessToken, res.refreshToken);
    await loadMe();
  }, [loadMe]);

  const logOut = useCallback(async () => {
    await clearTokens();
    setUser(null);
  }, []);

  return (
    <SessionContext.Provider value={{ user, isLoading, signIn, signUp, logOut, refreshMe: loadMe }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within a SessionProvider");
  return ctx;
}
