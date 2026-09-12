module.exports = {
  preset: "jest-expo",
  testPathIgnorePatterns: ["/node_modules/", "/.expo/"],
  setupFiles: ["./jest.setup.js"],
  // jest-expo cold renders can exceed the 5s default on loaded/slow machines
  // (TravelScreen/TimerScreen suites flake under load, pass in isolation).
  // A hung test still fails at 15s; this only gives slow-but-correct renders room.
  testTimeout: 15000,
  moduleNameMapper: {
    "^@semse/design-tokens$": "<rootDir>/../../packages/design-tokens/dist/index.js",
    "^@semse/schemas$": "<rootDir>/../../packages/schemas/dist/index.js",
  },
};
