import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { AdminTabParamList } from "./types";
import AdminDashboardScreen from "../screens/admin/AdminDashboardScreen";
import AdminSettingsScreen from "../screens/admin/AdminSettingsScreen";

const Tab = createBottomTabNavigator<AdminTabParamList>();

// Fase 7a: Dashboard (jobs overview, read-only) + Settings (logout) are
// real. The rest of Fase 7 (contractors, finance, disputes management,
// labor-engine overview) is still pending — see
// docs/specs/ui/mobile-admin-dashboard.spec.md for exact scope.
export default function AdminTabNavigator() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Dashboard" component={AdminDashboardScreen} options={{ title: "SEMSE — Admin" }} />
      <Tab.Screen name="Settings" component={AdminSettingsScreen} options={{ title: "Ajustes" }} />
    </Tab.Navigator>
  );
}
