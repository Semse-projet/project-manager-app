import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { AdminTabParamList } from "./types";
import AdminDashboardScreen from "../screens/admin/AdminDashboardScreen";
import AdminDisputesStackNavigator from "./AdminDisputesStackNavigator";
import AdminContractorsScreen from "../screens/admin/AdminContractorsScreen";
import AdminSettingsScreen from "../screens/admin/AdminSettingsScreen";

const Tab = createBottomTabNavigator<AdminTabParamList>();

// Fase 7a: Dashboard (jobs overview, read-only) + Settings (logout).
// Fase 7b: Disputes (tenant-wide, read-only -- no assign/resolve/archive).
// Fase 7c: Contractors (org-scoped leads list + stats + create -- no status
// change/delete/estimate actions).
// The rest of Fase 7 (finance, disputes management actions, labor-engine
// overview) is still pending -- see docs/specs/ui/mobile-admin-dashboard.spec.md,
// docs/specs/ui/mobile-admin-disputes.spec.md and
// docs/specs/ui/mobile-admin-contractors.spec.md for exact scope.
export default function AdminTabNavigator() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Dashboard" component={AdminDashboardScreen} options={{ title: "SEMSE — Admin" }} />
      {/* headerShown: false -- AdminDisputesStackNavigator renders its own per-screen headers, avoiding a double header bar. */}
      <Tab.Screen name="Disputes" component={AdminDisputesStackNavigator} options={{ title: "Disputas", headerShown: false }} />
      <Tab.Screen name="Contractors" component={AdminContractorsScreen} options={{ title: "Contractors" }} />
      <Tab.Screen name="Settings" component={AdminSettingsScreen} options={{ title: "Ajustes" }} />
    </Tab.Navigator>
  );
}
