// issue #11 — Jest harness for the auth sign-in / sign-up hardening story.
// Config shape is pinned by tech-design.md's "Jest configuration" section
// (Phase 4, frozen) — do not diverge without re-freezing that artifact.
module.exports = {
  preset: "jest-expo",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  // jest-expo's default transformIgnorePatterns (see node_modules/jest-expo/jest-preset.js)
  // doesn't transpile @noble/* — added post-freeze when the E2E identity/crypto
  // rework (src/crypto/**) landed pure-ESM @noble/ciphers, @noble/curves and
  // @noble/hashes as transitive imports of SessionContext. Same pattern as the
  // preset default, with "@noble" added to the allow-list; everything else unchanged.
  transformIgnorePatterns: [
    "/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|standard-navigation|@noble))",
    "/node_modules/react-native-reanimated/plugin/",
    "/node_modules/@react-native/babel-preset/",
  ],
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
