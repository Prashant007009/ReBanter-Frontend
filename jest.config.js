// issue #11 — Jest harness for the auth sign-in / sign-up hardening story.
// Config shape is pinned by tech-design.md's "Jest configuration" section
// (Phase 4, frozen) — do not diverge without re-freezing that artifact.
module.exports = {
  preset: "jest-expo",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  coverageProvider: "babel",
  collectCoverageFrom: [
    "src/screens/SignInScreen.tsx",
    "src/screens/SignUpScreen.tsx",
    "src/session/SessionContext.tsx",
    "src/api/client.ts",
    "src/auth/**/*.ts",
    "src/api/errors.ts",
  ],
  coverageThreshold: {
    global: {
      lines: 80,
      branches: 75,
    },
  },
};
