import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { WorkerJobsStackParamList } from "./types";
import JobsListScreen from "../screens/worker/JobsListScreen";
import JobDetailScreen from "../screens/worker/JobDetailScreen";
import EvidenceScreen from "../screens/worker/EvidenceScreen";

const Stack = createNativeStackNavigator<WorkerJobsStackParamList>();

export default function WorkerJobsStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="JobsList" component={JobsListScreen} options={{ title: "Jobs" }} />
      <Stack.Screen name="JobDetail" component={JobDetailScreen} options={{ title: "Detalle" }} />
      <Stack.Screen name="Evidence" component={EvidenceScreen} options={{ title: "Evidencia" }} />
    </Stack.Navigator>
  );
}
