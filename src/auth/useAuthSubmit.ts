// issue #11 — the submit lifecycle shared by SignInScreen and SignUpScreen
// (tech-design.md Component Design §4).
//
// "Run rules → short-circuit with field errors if invalid → set in-flight →
// call the session operation → on rejection, translate and place the message
// (form-level or field-level) → clear in-flight." The double-submit guard is
// a useRef latch checked synchronously at the top of the handler, not the
// isSubmitting state — state has not flushed when a second press lands in
// the same tick.
//
// `run` and `validate` are caller-supplied thunks that close over the
// screen's field state and the session operation, so this hook stays free of
// any `@/api/*` or `@/session/*` import — screens stay unaware of the
// transport, and this hook stays screen-agnostic (usable by both sign-in's
// two fields and sign-up's three).

import { useCallback, useRef, useState } from "react";
import type { FieldErrors } from "@/auth/authRules";
import { translateAuthError } from "@/auth/authMessages";

export interface UseAuthSubmitResult {
  isSubmitting: boolean;
  fieldErrors: FieldErrors;
  formError: string | null;
  submit: () => void;
}

export function useAuthSubmit(validate: () => FieldErrors, run: () => Promise<void>): UseAuthSubmitResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  const submit = useCallback(() => {
    // Checked synchronously, not via isSubmitting state — a second press in
    // the same tick would otherwise land before the first setState flushes.
    if (inFlightRef.current) return;

    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setFormError(null);
      return;
    }

    inFlightRef.current = true;
    setIsSubmitting(true);
    setFieldErrors({});
    setFormError(null);

    run()
      .then(() => {
        setFieldErrors({});
        setFormError(null);
      })
      .catch((err: unknown) => {
        const translated = translateAuthError(err);
        if (translated.field) {
          setFieldErrors({ [translated.field]: translated.message });
          setFormError(null);
        } else {
          setFieldErrors({});
          setFormError(translated.message);
        }
      })
      .finally(() => {
        inFlightRef.current = false;
        setIsSubmitting(false);
      });
  }, [validate, run]);

  return { isSubmitting, fieldErrors, formError, submit };
}
