import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { WorkerMoreStackParamList } from "./types";
import MoreScreen from "../screens/worker/MoreScreen";
import FreeProjectsScreen from "../screens/FreeProjectsScreen";
import DisputesScreen from "../screens/worker/DisputesScreen";
import DisputeDetailScreen from "../screens/worker/DisputeDetailScreen";
import IncidentsScreen from "../screens/worker/IncidentsScreen";
import TravelScreen from "../screens/worker/TravelScreen";
import TravelDetailScreen from "../screens/worker/TravelDetailScreen";
import MaterialsScreen from "../screens/worker/MaterialsScreen";
import RatesScreen from "../screens/worker/RatesScreen";
import AgendaScreen from "../screens/worker/AgendaScreen";
import ReviewScreen from "../screens/worker/ReviewScreen";
import WorkerReviewFormScreen from "../screens/worker/WorkerReviewFormScreen";
import PaymentsScreen from "../screens/worker/PaymentsScreen";
import SettingsScreen from "../screens/SettingsScreen";
import PrometeoScreen from "../screens/worker/PrometeoScreen";
import LiveSessionScreen from "../screens/LiveSessionScreen";

const Stack = createNativeStackNavigator<WorkerMoreStackParamList>();

export default function WorkerMoreStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="MoreMenu" component={MoreScreen} options={{ title: "Más" }} />
      <Stack.Screen name="FreeProjects" component={FreeProjectsScreen} options={{ title: "Proyectos libres" }} />
      <Stack.Screen name="Disputes" component={DisputesScreen} options={{ title: "Disputas" }} />
      <Stack.Screen name="DisputeDetail" component={DisputeDetailScreen} options={{ title: "Disputa" }} />
      <Stack.Screen name="Incidents" component={IncidentsScreen} options={{ title: "Incidentes" }} />
      <Stack.Screen name="Travel" component={TravelScreen} options={{ title: "Viajes" }} />
      <Stack.Screen name="TravelDetail" component={TravelDetailScreen} options={{ title: "Viaje" }} />
      <Stack.Screen name="Materials" component={MaterialsScreen} options={{ title: "Materiales" }} />
      <Stack.Screen name="Rates" component={RatesScreen} options={{ title: "Tarifas" }} />
      <Stack.Screen name="Agenda" component={AgendaScreen} options={{ title: "Agenda" }} />
      <Stack.Screen name="Review" component={ReviewScreen} options={{ title: "Reseñas" }} />
      <Stack.Screen name="ReviewForm" component={WorkerReviewFormScreen} options={{ title: "Calificar" }} />
      <Stack.Screen name="Payments" component={PaymentsScreen} options={{ title: "Pagos" }} />
      <Stack.Screen name="Prometeo" component={PrometeoScreen} options={{ title: "Prometeo" }} />
      <Stack.Screen name="LiveSession" component={LiveSessionScreen} options={{ title: "Sesión en vivo" }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: "Ajustes" }} />
    </Stack.Navigator>
  );
}
