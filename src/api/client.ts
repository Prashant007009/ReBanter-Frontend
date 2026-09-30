import { getAccessToken, getRefreshToken, setTokens, clearTokens } from "@/session/tokenStore";
import { apiErrorFromNetworkFailure, apiErrorFromResponse } from "@/api/errors";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

export class SessionExpiredError extends Error {
  constructor() {
    super("Session expired — sign in again");
  }
}

/** Runs `fetch`, wrapping a rejection (unreachable host, offline, ...) as a network-classified `ApiError` — additive: still an `Error`, still `err.message` verbatim. */
async function fetchOrThrowClassified(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch (err) {
    throw apiErrorFromNetworkFailure(path, err);
  }
}

async function rawFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetchOrThrowClassified(path, init);
  if (!res.ok) {
    throw await apiErrorFromResponse(path, res);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) return null;
      try {
        const tokens = await rawFetch<{ accessToken: string; refreshToken: string }>("/api/auth/refresh", {
          method: "POST",
          body: JSON.stringify({ refreshToken }),
        });
        await setTokens(tokens.accessToken, tokens.refreshToken);
        return tokens.accessToken;
      } catch {
        await clearTokens();
        return null;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

/** Attaches the stored access token and retries once through a refresh on 401. */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const accessToken = await getAccessToken();
  const headers = { ...init?.headers, ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) };

  const res = await fetchOrThrowClassified(path, { ...init, headers });

  if (res.status === 401 && accessToken) {
    const newAccessToken = await refreshAccessToken();
    if (!newAccessToken) throw new SessionExpiredError();
    return apiFetch<T>(path, init);
  }

  if (!res.ok) {
    throw await apiErrorFromResponse(path, res);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export { rawFetch };
