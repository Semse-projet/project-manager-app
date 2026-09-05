import { useEffect, type ReactElement } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StripeProvider } from "@stripe/stripe-react-native";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import { AuthProvider } from "./src/context/AuthContext";
import RootNavigator from "./src/navigation/RootNavigator";
import { registerProximityResponseListener } from "./src/notifications/proximityResponseHandler";
import { isStripeConfigured, STRIPE_PUBLISHABLE_KEY } from "./src/config/stripe";

/** No-ops when Stripe isn't configured yet — same gating as apps/web's isStripeConfigured() — rather than mounting the native SDK with an invalid key. */
function MaybeStripeProvider({ children }: { children: ReactElement }) {
  if (!isStripeConfigured()) return children;
  return <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY!}>{children}</StripeProvider>;
}

export default function App() {
  useEffect(() => {
    const unregister = registerProximityResponseListener();
    return unregister;
  }, []);

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <MaybeStripeProvider>
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </MaybeStripeProvider>
      </ErrorBoundary>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
