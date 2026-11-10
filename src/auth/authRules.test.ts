// issue #11 — unit tests for src/auth/authRules.ts (NEW, does not exist yet).
//
// Rule values are pinned by decisions.md Phase 4 Decisions 6 & 7 and
// tech-design.md's Clarifications §Q6 (frozen): handle = lowercase
// alphanumeric plus dot/underscore, 3-30 characters; display name 1-50
// characters; password >= 8 characters. Every rule is evaluated against
// TRIMMED input (spec.md Solution Outline item 4 / Success Criteria) so a
// whitespace-only field is rejected as empty rather than trimmed and
// submitted as empty. The server's rejection is always authoritative on
// disagreement — these are client-side, pre-submission checks only.
//
// Interface pinned by this test file (tech-design.md Component Design §4
// describes the behaviour but not the literal signature — this is the
// concrete, compilable contract Phase 6 implements against):
//   validateHandle(value: string): string | undefined
//   validateDisplayName(value: string): string | undefined
//   validatePassword(value: string): string | undefined
//   validateSignIn(fields: { handle: string; password: string }): FieldErrors
//   validateSignUp(fields: { handle: string; displayName: string; password: string }): FieldErrors
// An empty FieldErrors object (`{}`) means valid, per tech-design.md.

import { validateHandle, validateDisplayName, validatePassword, validateSignIn, validateSignUp } from "@/auth/authRules";

describe("validateHandle", () => {
  it("rejects an empty handle as required", () => {
    expect(validateHandle("")).toEqual(expect.any(String));
  });

  it("rejects a whitespace-only handle as required, not as valid empty-trimmed input", () => {
    expect(validateHandle("   ")).toEqual(expect.any(String));
  });

  it("rejects a handle below the 3-character minimum", () => {
    expect(validateHandle("ab")).toEqual(expect.any(String));
  });

  it("accepts a handle exactly at the 3-character minimum", () => {
    expect(validateHandle("abc")).toBeUndefined();
  });

  it("accepts a handle exactly at the 30-character maximum", () => {
    expect(validateHandle("a".repeat(30))).toBeUndefined();
  });

  it("rejects a handle over the 30-character maximum", () => {
    expect(validateHandle("a".repeat(31))).toEqual(expect.any(String));
  });

  it("rejects uppercase characters", () => {
    expect(validateHandle("Zoe.b")).toEqual(expect.any(String));
  });

  it("rejects disallowed characters (e.g. a space or an @)", () => {
    expect(validateHandle("zoe b")).toEqual(expect.any(String));
    expect(validateHandle("zoe@b")).toEqual(expect.any(String));
  });

  it("accepts the documented example handle, dot and underscore included", () => {
    expect(validateHandle("zoe.b")).toBeUndefined();
    expect(validateHandle("zoe_b")).toBeUndefined();
  });

  it("trims surrounding whitespace before evaluating the other rules", () => {
    expect(validateHandle("  zoe.b  ")).toBeUndefined();
  });
});

describe("validateDisplayName", () => {
  it("rejects an empty display name as required", () => {
    expect(validateDisplayName("")).toEqual(expect.any(String));
  });

  it("rejects a whitespace-only display name as required", () => {
    expect(validateDisplayName("   ")).toEqual(expect.any(String));
  });

  it("accepts a single-character display name (1-char minimum)", () => {
    expect(validateDisplayName("Z")).toBeUndefined();
  });

  it("accepts a display name exactly at the 50-character maximum", () => {
    expect(validateDisplayName("Z".repeat(50))).toBeUndefined();
  });

  it("rejects a display name over the 50-character maximum", () => {
    expect(validateDisplayName("Z".repeat(51))).toEqual(expect.any(String));
  });
});

describe("validatePassword", () => {
  it("rejects an empty password as required", () => {
    expect(validatePassword("")).toEqual(expect.any(String));
  });

  it("rejects a whitespace-only password as required, not as valid empty-trimmed input", () => {
    expect(validatePassword("        ")).toEqual(expect.any(String));
  });

  it("rejects a 7-character password (below the boundary)", () => {
    expect(validatePassword("a".repeat(7))).toEqual(expect.any(String));
  });

  it("accepts an 8-character password (at the boundary)", () => {
    expect(validatePassword("a".repeat(8))).toBeUndefined();
  });

  it("accepts a 9-character password (above the boundary)", () => {
    expect(validatePassword("a".repeat(9))).toBeUndefined();
  });
});

describe("validateSignIn_allFieldsValid_returnsEmptyErrors", () => {
  it("returns an empty object when both fields pass", () => {
    expect(validateSignIn({ handle: "zoe.b", password: "correct-horse-battery" })).toEqual({});
  });
});

describe("validateSignIn_invalidFields_returnsNamedFieldErrors", () => {
  it("returns an error keyed by 'handle' and by 'password' when both are invalid", () => {
    const errors = validateSignIn({ handle: "", password: "short" });
    expect(errors.handle).toEqual(expect.any(String));
    expect(errors.password).toEqual(expect.any(String));
    expect(errors.displayName).toBeUndefined();
  });
});

describe("validateSignUp_allFieldsValid_returnsEmptyErrors", () => {
  it("returns an empty object when all three fields pass", () => {
    const errors = validateSignUp({ handle: "zoe.b", displayName: "Zoe B", password: "correct-horse-battery" });
    expect(errors).toEqual({});
  });
});

describe("validateSignUp_invalidFields_returnsNamedFieldErrors", () => {
  it("returns an error keyed by each invalid field, and only those fields", () => {
    const errors = validateSignUp({ handle: "AB", displayName: "", password: "short" });
    expect(errors.handle).toEqual(expect.any(String));
    expect(errors.displayName).toEqual(expect.any(String));
    expect(errors.password).toEqual(expect.any(String));
  });

  it("returns only a handle error when display name and password are valid", () => {
    const errors = validateSignUp({ handle: "!!", displayName: "Zoe B", password: "correct-horse-battery" });
    expect(Object.keys(errors)).toEqual(["handle"]);
  });
});
