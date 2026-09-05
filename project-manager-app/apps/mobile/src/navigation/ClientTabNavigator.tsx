import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { ClientTabParamList } from "./types";
import ClientJobsStackNavigator from "./ClientJobsStackNavigator";
import ClientSettingsScreen from "../screens/client/ClientSettingsScreen";

const Tab = createBottomTabNavigator<ClientTabParamList>();

export default function ClientTabNavigator() {
  return (
    <Tab.Navigator>
      {/* headerShown: false — ClientJobsStackNavigator renders its own per-screen headers, avoiding a double header bar. */}
      <Tab.Screen name="Jobs" component={ClientJobsStackNavigator} options={{ title: "Jobs", headerShown: false }} />
      <Tab.Screen name="Settings" component={ClientSettingsScreen} options={{ title: "Ajustes" }} />
    </Tab.Navigator>
  );
}
