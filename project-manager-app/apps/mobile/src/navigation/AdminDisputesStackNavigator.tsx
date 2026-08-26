import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { AdminDisputesStackParamList } from "./types";
import AdminDisputesScreen from "../screens/admin/AdminDisputesScreen";
import AdminDisputeDetailScreen from "../screens/admin/AdminDisputeDetailScreen";

const Stack = createNativeStackNavigator<AdminDisputesStackParamList>();

export default function AdminDisputesStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="DisputesList" component={AdminDisputesScreen} options={{ title: "Disputas" }} />
      <Stack.Screen name="DisputeDetail" component={AdminDisputeDetailScreen} options={{ title: "Detalle" }} />
    </Stack.Navigator>
  );
}
