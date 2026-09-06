module.exports = {
  preset: "jest-expo",
  testMatch: ["<rootDir>/src/**/*.test.[jt]s?(x)"],
  testPathIgnorePatterns: ["/node_modules/", "/.expo/"],
  testTimeout: 15000,
  setupFiles: ["./jest.setup.js"],
  moduleNameMapper: {
    "^react$": "<rootDir>/node_modules/react",
  },
};
