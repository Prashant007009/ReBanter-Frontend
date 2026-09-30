import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiFetch, rawFetch } from "@/api/client";
import { ApiError } from "@/api/errors";
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

/**
 * Type guard over the assumed `AuthResponse` shape. A 2xx with a body
 * missing `user.id`, `accessToken` or `refreshToken` would otherwise store
 * `undefined` tokens silently — this catches it before `setTokens` runs.
 */
function isValidAuthResponse(value: unknown): value is AuthResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AuthResponse>;
  if (typeof candidate.accessToken !== "string" || typeof candidate.refreshToken !== "string") return false;
  if (!candidate.user || typeof candidate.user !== "object") return false;
  return typeof (candidate.user as { id?: unknown }).id === "string";
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

  // Shared by signIn and signUp so any future caller inherits the same
  // all-or-nothing guarantee (todo.md 2.5): reject a malformed success body
  // before it can poison storage, then make the post-persistence profile
  // lookup atomic with the token write — any failure there rolls the whole
  // operation back rather than leaving a half-authenticated session.
  const completeAuthFromResponse = useCallback(
    async (path: string, body: unknown) => {
      if (!isValidAuthResponse(body)) {
        throw new ApiError({
          message: `API ${path} failed: 200`,
          status: 200,
          statusClass: "malformed",
          body,
          path,
        });
      }

      await setTokens(body.accessToken, body.refreshToken);

      try {
        await loadMe();
      } catch (cause) {
        // Tokens were persisted but the profile lookup failed — the
        // half-authenticated state Decision 5 requires fixed. Roll back
        // everything and hand the caller a distinguishable, retryable error.
        await clearTokens();
        setUser(null);
        throw new Error("Profile lookup failed after credentials were accepted", { cause });
      }
    },
    [loadMe]
  );

  const signIn = useCallback(
    async (handle: string, password: string) => {
      const body = await rawFetch<unknown>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ handle, password }),
      });
      await completeAuthFromResponse("/api/auth/login", body);
    },
    [completeAuthFromResponse]
  );

  const signUp = useCallback(
    async (handle: string, displayName: string, password: string) => {
      const body = await rawFetch<unknown>("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({ handle, displayName, password }),
      });
      await completeAuthFromResponse("/api/auth/signup", body);
    },
    [completeAuthFromResponse]
  );

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
