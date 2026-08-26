import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { AdminTabParamList } from "./types";
import AdminDashboardScreen from "../screens/admin/AdminDashboardScreen";
import AdminDisputesStackNavigator from "./AdminDisputesStackNavigator";
import AdminLaborOverviewScreen from "../screens/admin/AdminLaborOverviewScreen";
import AdminSettingsScreen from "../screens/admin/AdminSettingsScreen";

const Tab = createBottomTabNavigator<AdminTabParamList>();

// Fase 7a: Dashboard (jobs overview, read-only) + Settings (logout).
// Fase 7b: Disputes (tenant-wide, read-only -- no assign/resolve/archive).
// Fase 7c: Labor (QualityGuard alerts + team weekly summary, read-only).
// The rest of Fase 7 (contractors, finance, dispute/timer mutations) is
// still pending -- see docs/specs/ui/mobile-admin-dashboard.spec.md,
// docs/specs/ui/mobile-admin-disputes.spec.md and
// docs/specs/ui/mobile-admin-labor-overview.spec.md for exact scope.
export default function AdminTabNavigator() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Dashboard" component={AdminDashboardScreen} options={{ title: "SEMSE — Admin" }} />
      {/* headerShown: false -- AdminDisputesStackNavigator renders its own per-screen headers, avoiding a double header bar. */}
      <Tab.Screen name="Disputes" component={AdminDisputesStackNavigator} options={{ title: "Disputas", headerShown: false }} />
      <Tab.Screen name="Labor" component={AdminLaborOverviewScreen} options={{ title: "Labor Engine" }} />
      <Tab.Screen name="Settings" component={AdminSettingsScreen} options={{ title: "Ajustes" }} />
    </Tab.Navigator>
  );
}
