import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import FreeProjectsScreen from "../screens/FreeProjectsScreen";
import LoginScreen from "../screens/LoginScreen";
import SettingsScreen from "../screens/SettingsScreen";
import TimerScreen from "../screens/TimerScreen";

export type RootStackParamList = {
  Login: undefined;
  Timer: undefined;
  Settings: undefined;
  FreeProjects: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {isAuthenticated ? (
          <>
            <Stack.Screen
              name="Timer"
              component={TimerScreen}
              options={({ navigation }) => ({
                title: "SEMSE — Timer",
                headerRight: () => (
                  <View style={{ flexDirection: "row", gap: 16 }}>
                    <Pressable onPress={() => navigation.navigate("FreeProjects")} hitSlop={12}>
                      <Text style={{ color: "#2563eb", fontWeight: "700" }}>Proyectos</Text>
                    </Pressable>
                    <Pressable onPress={() => navigation.navigate("Settings")} hitSlop={12}>
                      <Text style={{ color: "#2563eb", fontWeight: "700" }}>Ajustes</Text>
                    </Pressable>
                  </View>
                ),
              })}
            />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: "Ajustes" }} />
            <Stack.Screen name="FreeProjects" component={FreeProjectsScreen} options={{ title: "Proyectos libres" }} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
