// Must be imported before registerRootComponent — expo-task-manager's
// defineTask() has to run at module scope so the task is already registered
// when the OS relaunches the app in a headless context for a location update.
import "./src/geo/backgroundLocationTask";

import { registerRootComponent } from "expo";

import App from "./App";

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
