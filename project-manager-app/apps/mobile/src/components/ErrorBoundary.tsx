import { Component, type ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * Release ("preview"/"production" profile) builds have no dev-mode red-box
 * overlay — a render-time crash anywhere below this just goes blank/frozen
 * with nothing on screen to debug from. This surfaces the error text
 * instead, since that's the difference between "the app is broken" and
 * "the app is broken and I can see why" when testing off a device with no
 * attached debugger.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}>
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#dc2626" }}>Ocurrió un error</Text>
            <Text style={{ fontSize: 14, color: "#111827" }}>{this.state.error.message}</Text>
            <Text style={{ fontSize: 11, color: "#6b7280" }}>{this.state.error.stack}</Text>
          </View>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}
