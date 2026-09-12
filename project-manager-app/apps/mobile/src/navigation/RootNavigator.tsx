import { useEffect } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import LoginScreen from "../screens/LoginScreen";
import ForgotPasswordScreen from "../screens/ForgotPasswordScreen";
import RoleGate, { resolveAvailableTargets } from "./RoleGate";
import { useTheme } from "../theme/theme";
import { navigationRef } from "./navigationRef";
import { registerWorkerPushResponseListener } from "../notifications/pushResponseHandler";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { loading, isAuthenticated, roles, userId, tenantId, sessionError, retrySession, logout } = useAuth();
  const theme = useTheme();
  const navigationTheme = {
    ...(theme.colors.base === "#050810" ? DarkTheme : DefaultTheme),
    colors: {
      primary: theme.colors.brand, background: theme.colors.base,
      card: theme.colors.surface, text: theme.colors.ink,
      border: theme.colors.border, notification: theme.colors.accent,
    },
  };
  const isWorker = isAuthenticated && resolveAvailableTargets(roles).includes("worker");

  useEffect(() => {
    if (!isWorker) return;
    return registerWorkerPushResponseListener();
  }, [isWorker]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.colors.base }}>
        <ActivityIndicator color={theme.colors.brand} />
      </View>
    );
  }

  if (sessionError && !isAuthenticated) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 20, backgroundColor: theme.colors.base }}>
        <Text style={{ color: theme.colors.ink, fontSize: 24, fontWeight: "700" }}>Recuperar tu sesión</Text>
        <Text accessibilityRole="alert" style={{ color: theme.colors.muted }}>{sessionError}</Text>
        <Pressable accessibilityRole="button" onPress={() => void retrySession()} style={{ minHeight: 48, padding: 16, borderRadius: theme.radius.md, backgroundColor: theme.colors.brand }}>
          <Text style={{ color: "#fff", textAlign: "center", fontWeight: "700" }}>Reintentar</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => void logout()} style={{ minHeight: 48, padding: 16 }}>
          <Text style={{ color: theme.colors.ink, textAlign: "center" }}>Usar otra cuenta</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef} theme={navigationTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="Authenticated">{() => <RoleGate key={`${tenantId}:${userId}`} roles={roles} />}</Stack.Screen>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
