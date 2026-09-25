import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { apiFetch, rawFetch } from "@/api/client";
import { getAccessToken, setTokens, clearTokens } from "./tokenStore";
import { createKeyBackup, generateIdentity, openKeyBackup, toBase64, type KeyBackup } from "@/crypto/e2e";
import { forgetIdentity, loadIdentity, saveIdentity } from "@/crypto/identityStore";
import { clearBanterKeys, ensureBanterKey } from "@/crypto/banterKeys";
import { getBanters } from "@/api/banters";
import { realtimeSocket } from "@/realtime/socket";

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
  /** Status pill, stored as "emoji label" (e.g. "🛠️ Building things"). */
  vibe: string | null;
  hasJoinedRoom: boolean;
  stats: { drops: number; crew: number; visits: number };
}

interface IdentityKeys {
  publicKey: string;
  keyBackup: KeyBackup;
}

interface AuthResponse {
  user: Pick<MeProfile, "id" | "handle" | "displayName" | "avatarUrl">;
  /** The user's password-sealed E2E private key; null for accounts that predate E2E. */
  keys: IdentityKeys | null;
  accessToken: string;
  refreshToken: string;
}

async function newIdentityKeys(password: string) {
  const identity = generateIdentity();
  const keys: IdentityKeys = { publicKey: toBase64(identity.publicKey), keyBackup: await createKeyBackup(identity, password) };
  return { identity, keys };
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
        const me = await apiFetch<MeProfile>("/api/users/me");
        // Banters are end-to-end encrypted: without this device's private key
        // (e.g. a session from before E2E) the password is needed to unlock it,
        // so fall back to the sign-in screen.
        if (!(await loadIdentity(me.id))) {
          await clearTokens();
          return;
        }
        setUser(me);
      } catch {
        // No token, invalid token, refresh failed, or storage unavailable —
        // any of these just means "stay signed out," never "hang forever."
      } finally {
        setIsLoading(false);
      }
    })();
  }, [loadMe]);

  // While signed in, stay on the realtime socket and act as a key holder: the
  // server can't hand out banter keys (it never has them), so whenever another
  // member is missing one, whichever of their banter partners' apps is online
  // seals it for them — no need for anyone to reopen that thread.
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    realtimeSocket.connect();
    const offKeyRequest = realtimeSocket.on("banter.keyRequest", (payload) => {
      ensureBanterKey((payload as { banterId: string }).banterId).catch(() => {});
    });
    getBanters().catch(() => {}); // also serves anyone who asked while we were offline
    return () => {
      offKeyRequest();
      realtimeSocket.disconnect();
    };
  }, [userId]);

  const signIn = useCallback(async (handle: string, password: string) => {
    const res = await rawFetch<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ handle, password }),
    });
    await setTokens(res.accessToken, res.refreshToken);
    if (res.keys) {
      await saveIdentity(res.user.id, await openKeyBackup(res.keys.keyBackup, password));
    } else {
      // Account predates E2E — set up its identity now, while we have the password.
      const { identity, keys } = await newIdentityKeys(password);
      await apiFetch("/api/users/me/keys", { method: "PUT", body: JSON.stringify(keys) });
      await saveIdentity(res.user.id, identity);
    }
    await loadMe();
  }, [loadMe]);

  const signUp = useCallback(async (handle: string, displayName: string, password: string) => {
    const { identity, keys } = await newIdentityKeys(password);
    const res = await rawFetch<AuthResponse>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ handle, displayName, password, keys }),
    });
    await setTokens(res.accessToken, res.refreshToken);
    await saveIdentity(res.user.id, identity);
    await loadMe();
  }, [loadMe]);

  const logOut = useCallback(async () => {
    await clearTokens();
    if (user) await forgetIdentity(user.id);
    clearBanterKeys();
    setUser(null);
  }, [user]);

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
