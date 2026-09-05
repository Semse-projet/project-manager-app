import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { WorkerTabParamList } from "./types";
import TimerScreen from "../screens/TimerScreen";
import BidsScreen from "../screens/worker/BidsScreen";
import WorkerJobsStackNavigator from "./WorkerJobsStackNavigator";
import WorkerMoreStackNavigator from "./WorkerMoreStackNavigator";

const Tab = createBottomTabNavigator<WorkerTabParamList>();

export default function WorkerTabNavigator() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Timer" component={TimerScreen} options={{ title: "SEMSE — Timer" }} />
      {/* headerShown: false on both stack tabs below — the nested stack navigators render their own per-screen headers, avoiding a double header bar. */}
      <Tab.Screen name="Jobs" component={WorkerJobsStackNavigator} options={{ title: "Jobs", headerShown: false }} />
      <Tab.Screen name="Bids" component={BidsScreen} options={{ title: "Mis propuestas" }} />
      <Tab.Screen name="More" component={WorkerMoreStackNavigator} options={{ title: "Más", headerShown: false }} />
    </Tab.Navigator>
  );
}
