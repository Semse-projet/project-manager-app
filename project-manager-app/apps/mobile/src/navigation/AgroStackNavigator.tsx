import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { AgroStackParamList } from "./types";
import AgroFarmsScreen from "../screens/worker/AgroFarmsScreen";
import AgroIncidentsScreen from "../screens/worker/AgroIncidentsScreen";
import AgroReportIncidentScreen from "../screens/worker/AgroReportIncidentScreen";
import AgroTasksScreen from "../screens/worker/AgroTasksScreen";

const Stack = createNativeStackNavigator<AgroStackParamList>();

export default function AgroStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="AgroFarms" component={AgroFarmsScreen} options={{ title: "Agro" }} />
      <Stack.Screen
        name="AgroIncidents"
        component={AgroIncidentsScreen}
        options={({ route }) => ({ title: route.params.farmName })}
      />
      <Stack.Screen name="AgroReportIncident" component={AgroReportIncidentScreen} options={{ title: "Reportar incidencia" }} />
      <Stack.Screen name="AgroTasks" component={AgroTasksScreen} options={{ title: "Mis tareas" }} />
    </Stack.Navigator>
  );
}
