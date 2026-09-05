import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { ClientJobsStackParamList } from "./types";
import JobsListScreen from "../screens/client/JobsListScreen";
import JobDetailScreen from "../screens/client/JobDetailScreen";
import RatingFormScreen from "../screens/client/RatingFormScreen";

const Stack = createNativeStackNavigator<ClientJobsStackParamList>();

export default function ClientJobsStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="JobsList" component={JobsListScreen} options={{ title: "Jobs" }} />
      <Stack.Screen name="JobDetail" component={JobDetailScreen} options={{ title: "Detalle" }} />
      <Stack.Screen name="Rating" component={RatingFormScreen} options={{ title: "Calificar" }} />
    </Stack.Navigator>
  );
}
