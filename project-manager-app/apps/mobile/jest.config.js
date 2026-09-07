module.exports = {
  preset: "jest-expo",
  testPathIgnorePatterns: ["/node_modules/", "/.expo/"],
  setupFiles: ["./jest.setup.js"],
  moduleNameMapper: {
    "^@semse/design-tokens$": "<rootDir>/../../packages/design-tokens/dist/index.js",
    "^@semse/schemas$": "<rootDir>/../../packages/schemas/dist/index.js",
  },
};
