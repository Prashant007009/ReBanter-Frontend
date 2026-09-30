// issue #11 — classified transport failure type.
//
// Gives a transport failure a type instead of a string, per tech-design.md
// Component Design §1 (frozen). `ApiError extends Error` so every existing
// `apiFetch`/`rawFetch` consumer — which reads only `err instanceof Error`
// and `err.message` — observes unchanged behaviour (the additive guarantee,
// Phase 3 Decision 2). `message` is built from the same expression the code
// used before this story: `body.error ?? \`API ${path} failed: ${res.status}\``
// for a response, and the original rejection's message verbatim for a
// network failure.

export type ApiErrorStatusClass = "network" | "client" | "server" | "malformed";

export interface ApiErrorInit {
  message: string;
  status: number | null;
  statusClass: ApiErrorStatusClass;
  body: unknown;
  path: string;
}

/**
 * A transport failure carrying enough information — status, a coarse status
 * class, and the parsed response body — for the orchestration layer to tell
 * a rejected credential from a duplicate identifier from an unreachable
 * host. Always an `Error`, so existing callers that only check
 * `err instanceof Error` / `err.message` keep working unmodified.
 */
export class ApiError extends Error {
  readonly status: number | null;
  readonly statusClass: ApiErrorStatusClass;
  readonly body: unknown;
  readonly path: string;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = "ApiError";
    this.status = init.status;
    this.statusClass = init.statusClass;
    this.body = init.body;
    this.path = init.path;
  }
}

/** Response-shaped surface `apiErrorFromResponse` needs — matches `fetch`'s `Response`. */
interface ResponseLike {
  status: number;
  json(): Promise<unknown>;
}

function classifyStatus(status: number): ApiErrorStatusClass {
  return status >= 500 ? "server" : "client";
}

function bodyErrorMessage(path: string, status: number, body: unknown): string {
  const maybeError = (body as { error?: unknown } | null)?.error;
  return typeof maybeError === "string" ? maybeError : `API ${path} failed: ${status}`;
}

/**
 * Builds a classified `ApiError` from a non-ok `Response` (or duck-typed
 * equivalent). Never throws, even when the body can't be parsed as JSON —
 * an unparseable body falls back to the same status-derived message the
 * transport has always used.
 */
export async function apiErrorFromResponse(path: string, res: ResponseLike): Promise<ApiError> {
  const body = await res.json().catch(() => ({}));
  return new ApiError({
    message: bodyErrorMessage(path, res.status, body),
    status: res.status,
    statusClass: classifyStatus(res.status),
    body,
    path,
  });
}

/**
 * Builds a classified `ApiError` from a rejected `fetch` call — the request
 * never reached a server at all, so `status` is `null` and `statusClass` is
 * always `"network"`. The message is the original rejection's message
 * verbatim, preserving today's behaviour for existing callers.
 */
export function apiErrorFromNetworkFailure(path: string, cause: unknown): ApiError {
  const message = cause instanceof Error ? cause.message : "Network request failed";
  return new ApiError({
    message,
    status: null,
    statusClass: "network",
    body: null,
    path,
  });
}
