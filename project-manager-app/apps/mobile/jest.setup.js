require("@testing-library/react-native/matchers");

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// Icon glyphs load a font asynchronously in real usage; in tests that's noise
// (and can leave a pending act() outside the test's control) — render a plain
// stub instead of the real font-backed icon component.
jest.mock("@expo/vector-icons", () => {
  const { createElement } = require("react");
  const stub = (name) => (props) => createElement("Icon", { ...props, iconName: name });
  return new Proxy({}, { get: (_target, iconFamily) => stub(iconFamily) });
});
