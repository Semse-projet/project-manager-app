// Compatibility bridge for older imports. The integrated app has one canonical
// role-aware navigator; keeping this export avoids two competing navigation trees.
export { default as AppNavigator } from "./RootNavigator";
