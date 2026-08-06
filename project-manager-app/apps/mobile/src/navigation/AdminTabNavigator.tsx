import { Text, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { AdminTabParamList } from "./types";

const Tab = createBottomTabNavigator<AdminTabParamList>();

// Placeholder until Fase 7 (admin-operativo screens: jobs, contractors,
// finance, disputes, labor-engine overview, etc.) — this stub exists so
// role-based nav routing works end-to-end for OPS_ADMIN users starting from
// Fase 1.
function AdminHomeScreen() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Text style={{ fontSize: 16, textAlign: "center" }}>
        La app de Admin todavía se está construyendo.
      </Text>
    </View>
  );
}

export default function AdminTabNavigator() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="AdminHome" component={AdminHomeScreen} options={{ title: "SEMSE — Admin" }} />
    </Tab.Navigator>
  );
}
