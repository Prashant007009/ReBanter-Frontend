// issue #11 — client-side validation rule set (tech-design.md Component
// Design §4 / Clarifications §Q6, frozen values).
//
// One rule set, applied identically by both screens, evaluated against
// TRIMMED input so a whitespace-only field is rejected as required rather
// than trimmed and silently submitted as empty. This is a client-side guess
// only — the server's rejection is always authoritative on disagreement.

export type AuthField = "handle" | "displayName" | "password";

export type FieldErrors = Partial<Record<AuthField, string>>;

const HANDLE_MIN = 3;
const HANDLE_MAX = 30;
const HANDLE_PATTERN = /^[a-z0-9._]+$/;

const DISPLAY_NAME_MIN = 1;
const DISPLAY_NAME_MAX = 50;

const PASSWORD_MIN = 8;

// Messages deliberately avoid repeating the field name (e.g. "Handle",
// "Password") — each field already carries a durable visible <Text> label
// with that exact word, and this text doubles as the field's
// accessibilityHint (tech-design.md Component Design §5). Repeating the
// field name here would make the label and the error text ambiguous
// duplicates under a case-insensitive substring query.

/** Validates a handle: required, 3-30 chars, lowercase alphanumeric plus dot/underscore. */
export function validateHandle(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) return "Required.";
  if (trimmed.length < HANDLE_MIN || trimmed.length > HANDLE_MAX) {
    return `Use ${HANDLE_MIN}–${HANDLE_MAX} characters.`;
  }
  if (!HANDLE_PATTERN.test(trimmed)) {
    return "Use lowercase letters, numbers, dots or underscores only.";
  }
  return undefined;
}

/** Validates a display name: required, 1-50 chars. */
export function validateDisplayName(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) return "Required.";
  if (trimmed.length > DISPLAY_NAME_MAX) {
    return `Keep it under ${DISPLAY_NAME_MAX} characters.`;
  }
  return undefined;
}

/** Validates a password: required (trimmed, so whitespace-only fails), at least 8 characters. */
export function validatePassword(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0) return "Required.";
  if (trimmed.length < PASSWORD_MIN) {
    return `Use at least ${PASSWORD_MIN} characters.`;
  }
  return undefined;
}

/** Runs the sign-in rule set. An empty object means every field is valid. */
export function validateSignIn(fields: { handle: string; password: string }): FieldErrors {
  const errors: FieldErrors = {};
  const handleError = validateHandle(fields.handle);
  const passwordError = validatePassword(fields.password);
  if (handleError) errors.handle = handleError;
  if (passwordError) errors.password = passwordError;
  return errors;
}

/** Runs the sign-up rule set. An empty object means every field is valid. */
export function validateSignUp(fields: { handle: string; displayName: string; password: string }): FieldErrors {
  const errors: FieldErrors = {};
  const handleError = validateHandle(fields.handle);
  const displayNameError = validateDisplayName(fields.displayName);
  const passwordError = validatePassword(fields.password);
  if (handleError) errors.handle = handleError;
  if (displayNameError) errors.displayName = displayNameError;
  if (passwordError) errors.password = passwordError;
  return errors;
}
