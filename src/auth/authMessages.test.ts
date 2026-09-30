// issue #11 — unit tests for src/auth/authMessages.ts (NEW, does not exist yet).
//
// Translates a classified `ApiError` (src/api/errors.ts, also new) — or the
// atomic-transition "handoff error" SessionContext throws on a post-persistence
// failure, which tech-design.md Component Design §3 describes as carrying
// "the original as cause" — into a message a person can act on, plus (where
// the response names one) the field it concerns.
//
// Field attribution rule is pinned by tech-design.md Data Design, verbatim:
// "field is read defensively — absent, the message lands form-level." That
// sentence is the authoritative spec for every "no field" case below; it is
// not this test file's own invention.
//
// Message COPY is deliberately not asserted verbatim anywhere in this file.
// Neither spec.md nor tech-design.md pins exact wording — only "specific,
// readable", "distinct" per failure class, and never a verbatim pass-through
// of raw server text (spec.md Solution Outline item 2). Phase 6 is free to
// choose the actual copy; these tests instead assert the structural
// properties the frozen artifacts DO pin: non-empty, correct field
// attribution, and mutual distinctness across failure classes.
//
// Interface pinned by this test file:
//   translateAuthError(error: unknown): { message: string; field?: "handle" | "displayName" | "password" }

import { ApiError } from "@/api/errors";
import { translateAuthError } from "@/auth/authMessages";
import {
  wrongCredentialsBody,
  handleTakenBody,
  handleTakenBodyNoField,
  weakPasswordBody,
  unknownFieldBody,
} from "@/testing/fixtures/authFixtures";

function clientError(status: number, body: unknown, path = "/api/auth/login"): ApiError {
  return new ApiError({ message: "raw-server-text-should-not-leak", status, statusClass: "client", body, path });
}

describe("translateAuthError_401_credentialRejected", () => {
  it("produces a non-empty, form-level message (no field) for a 401", () => {
    const result = translateAuthError(clientError(401, wrongCredentialsBody));

    expect(result.message.length).toBeGreaterThan(0);
    expect(result.field).toBeUndefined();
  });

  it("does not pass the raw server error text through verbatim", () => {
    const result = translateAuthError(clientError(401, wrongCredentialsBody));

    expect(result.message).not.toBe(wrongCredentialsBody.error);
  });
});

describe("translateAuthError_409WithField_identifierTakenAttributedToHandle", () => {
  it("attributes the message to the handle field when the body names it", () => {
    const result = translateAuthError(clientError(409, handleTakenBody, "/api/auth/signup"));

    expect(result.field).toBe("handle");
    expect(result.message.length).toBeGreaterThan(0);
  });
});

describe("translateAuthError_409WithoutField_landsFormLevel", () => {
  it("falls back to form-level (no field) when the body omits field, per Data Design's defensive read", () => {
    const result = translateAuthError(clientError(409, handleTakenBodyNoField, "/api/auth/signup"));

    expect(result.field).toBeUndefined();
  });
});

describe("translateAuthError_422WithField_weakPasswordAttributedToPassword", () => {
  it("attributes the message to the password field when the body names it", () => {
    const result = translateAuthError(clientError(422, weakPasswordBody, "/api/auth/signup"));

    expect(result.field).toBe("password");
    expect(result.message.length).toBeGreaterThan(0);
  });
});

describe("translateAuthError_400WithUnknownField_landsFormLevel", () => {
  it("does not attribute to a field the client doesn't recognise", () => {
    const result = translateAuthError(clientError(400, unknownFieldBody, "/api/auth/signup"));

    expect(result.field).toBeUndefined();
    expect(result.message.length).toBeGreaterThan(0);
  });
});

describe("translateAuthError_networkClass_distinctConnectivityMessage", () => {
  it("produces a form-level message for a network-classified ApiError", () => {
    const error = new ApiError({ message: "Network request failed", status: null, statusClass: "network", body: null, path: "/api/auth/login" });
    const result = translateAuthError(error);

    expect(result.field).toBeUndefined();
    expect(result.message.length).toBeGreaterThan(0);
  });
});

describe("translateAuthError_malformedOrUnparseable_distinctGenericMessage", () => {
  it("produces a form-level message for statusClass 'malformed' without throwing", () => {
    const error = new ApiError({ message: "API /api/auth/login failed: 200", status: 200, statusClass: "malformed", body: {}, path: "/api/auth/login" });

    expect(() => translateAuthError(error)).not.toThrow();
    const result = translateAuthError(error);
    expect(result.message.length).toBeGreaterThan(0);
  });

  it("produces a form-level message for statusClass 'server' with an unparseable/empty body", () => {
    const error = new ApiError({ message: "API /api/auth/login failed: 502", status: 502, statusClass: "server", body: {}, path: "/api/auth/login" });
    const result = translateAuthError(error);

    expect(result.field).toBeUndefined();
    expect(result.message.length).toBeGreaterThan(0);
  });
});

describe("translateAuthError_handoffErrorWithApiErrorCause_unwrapsAndTranslatesCause", () => {
  it("translates the underlying ApiError cause of the atomic-transition handoff error (scenario 9)", () => {
    const cause = clientError(500, {}, "/api/users/me");
    const handoff = new Error("profile lookup failed after credentials were accepted", { cause });

    const result = translateAuthError(handoff);

    expect(result.message.length).toBeGreaterThan(0);
    expect(result.field).toBeUndefined();
  });
});

describe("translateAuthError_unrecognisedInput_fallsBackToGenericMessage", () => {
  it("never throws and never returns an empty message, even for input that isn't an ApiError", () => {
    expect(() => translateAuthError(new Error("some other error"))).not.toThrow();
    expect(translateAuthError(new Error("some other error")).message.length).toBeGreaterThan(0);
    expect(() => translateAuthError("not an error at all")).not.toThrow();
  });
});

describe("translateAuthError_distinctnessAcrossFailureClasses", () => {
  it("produces mutually distinct messages for credential-rejected, identifier-taken, weak-password, network and malformed", () => {
    const messages = [
      translateAuthError(clientError(401, wrongCredentialsBody)).message,
      translateAuthError(clientError(409, handleTakenBody, "/api/auth/signup")).message,
      translateAuthError(clientError(422, weakPasswordBody, "/api/auth/signup")).message,
      translateAuthError(new ApiError({ message: "x", status: null, statusClass: "network", body: null, path: "/api/auth/login" })).message,
      translateAuthError(new ApiError({ message: "x", status: 200, statusClass: "malformed", body: {}, path: "/api/auth/login" })).message,
    ];

    expect(new Set(messages).size).toBe(messages.length);
  });
});
