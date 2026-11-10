// issue #11 — translates a classified transport failure into a message a
// person can act on (tech-design.md Component Design §4).
//
// This is orchestration work, not presentation work (spec.md Solution
// Outline item 2): raw server text is never passed through verbatim, and
// each failure class produces a specific, mutually distinct message. Field
// attribution follows tech-design.md Data Design's defensive read — "field
// is read defensively — absent, the message lands form-level" — and a field
// name the client doesn't recognise is treated the same as no field at all.

import { ApiError } from "@/api/errors";
import type { AuthField } from "@/auth/authRules";

export interface TranslatedAuthError {
  message: string;
  field?: AuthField;
}

const RECOGNISED_FIELDS: ReadonlySet<string> = new Set<AuthField>(["handle", "displayName", "password"]);

const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";
const NETWORK_ERROR_MESSAGE = "We can't reach the server. Check your connection and try again.";
const MALFORMED_ERROR_MESSAGE = "Something unexpected happened on our end. Please try again.";
const SERVER_ERROR_MESSAGE = "The server ran into a problem. Please try again in a moment.";
const CREDENTIAL_REJECTED_MESSAGE = "That handle or password doesn't look right.";
const IDENTIFIER_TAKEN_MESSAGE = "That handle is already taken.";
const VALIDATION_REJECTED_MESSAGE = "The server rejected that value — please check it and try again.";

function readField(body: unknown): AuthField | undefined {
  const candidate = (body as { field?: unknown } | null)?.field;
  return typeof candidate === "string" && RECOGNISED_FIELDS.has(candidate) ? (candidate as AuthField) : undefined;
}

function translateApiError(error: ApiError): TranslatedAuthError {
  switch (error.statusClass) {
    case "network":
      return { message: NETWORK_ERROR_MESSAGE };
    case "malformed":
      return { message: MALFORMED_ERROR_MESSAGE };
    case "server":
      return { message: SERVER_ERROR_MESSAGE };
    case "client":
    default:
      return translateClientError(error);
  }
}

function translateClientError(error: ApiError): TranslatedAuthError {
  if (error.status === 401) {
    return { message: CREDENTIAL_REJECTED_MESSAGE };
  }

  if (error.status === 409) {
    const field = readField(error.body);
    return field ? { message: IDENTIFIER_TAKEN_MESSAGE, field } : { message: IDENTIFIER_TAKEN_MESSAGE };
  }

  if (error.status === 400 || error.status === 422) {
    const field = readField(error.body);
    return field ? { message: fieldRejectionMessage(field), field } : { message: VALIDATION_REJECTED_MESSAGE };
  }

  return { message: GENERIC_ERROR_MESSAGE };
}

function fieldRejectionMessage(field: AuthField): string {
  switch (field) {
    case "password":
      return "That password doesn't meet the requirements.";
    case "handle":
      return "That handle isn't valid.";
    case "displayName":
      return "That display name isn't valid.";
    default:
      return VALIDATION_REJECTED_MESSAGE;
  }
}

/**
 * Translates any rejection the sign-in / sign-up flow can surface — a
 * classified `ApiError`, the atomic-transition "handoff error" `SessionContext`
 * throws (an `Error` carrying the original `ApiError` as `cause`), or
 * anything else — into a message and, where the response names one, the
 * field it concerns. Never throws and never returns an empty message.
 */
export function translateAuthError(error: unknown): TranslatedAuthError {
  if (error instanceof ApiError) {
    return translateApiError(error);
  }

  if (error instanceof Error && error.cause instanceof ApiError) {
    return translateApiError(error.cause);
  }

  return { message: GENERIC_ERROR_MESSAGE };
}
