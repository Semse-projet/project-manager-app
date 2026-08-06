import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import WorkerTabNavigator from "./WorkerTabNavigator";
import ClientTabNavigator from "./ClientTabNavigator";
import AdminTabNavigator from "./AdminTabNavigator";
import { useTheme } from "../theme/theme";

export type RoleTarget = "worker" | "client" | "admin";

const TARGET_LABEL: Record<RoleTarget, string> = {
  worker: "Trabajo",
  client: "Cliente",
  admin: "Admin",
};

/**
 * Every RBAC role key (packages/db/prisma/seed.ts) that grants access to a
 * given tab navigator. PRO and WORKER both map to "worker" — see the
 * comment in ./types.ts for why.
 */
const ROLE_TO_TARGET: Record<string, RoleTarget> = {
  PRO: "worker",
  WORKER: "worker",
  CLIENT: "client",
  OPS_ADMIN: "admin",
};

/**
 * Default priority when a user holds multiple relevant roles — "worker"
 * first since it was the first tab built out (Fase 1); Client has real
 * screens too now (Fase 2, see docs/specs/ui/mobile-client-tab.spec.md).
 * Admin is still a placeholder (Fase 7). The switcher lets the user
 * override this, but the default landing tab should be the one most likely
 * to be what a multi-role user wants first.
 */
const TARGET_PRIORITY: RoleTarget[] = ["worker", "client", "admin"];

export function resolveAvailableTargets(roles: string[]): RoleTarget[] {
  const set = new Set<RoleTarget>();
  for (const role of roles) {
    const target = ROLE_TO_TARGET[role];
    if (target) set.add(target);
  }
  return TARGET_PRIORITY.filter((t) => set.has(t));
}

function renderTarget(target: RoleTarget) {
  switch (target) {
    case "worker":
      return <WorkerTabNavigator />;
    case "client":
      return <ClientTabNavigator />;
    case "admin":
      return <AdminTabNavigator />;
  }
}

/** Mounts the tab navigator for the authenticated user's role. When a user holds more than one relevant role, shows a small switcher above the tabs. */
export default function RoleGate({ roles }: { roles: string[] }) {
  const available = resolveAvailableTargets(roles);
  const [selected, setSelected] = useState<RoleTarget | null>(available[0] ?? null);
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const active = selected && available.includes(selected) ? selected : available[0] ?? null;

  if (!active) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24, paddingTop: insets.top + 24, backgroundColor: theme.colors.base }}>
        <Text style={{ fontSize: 16, textAlign: "center", color: theme.colors.ink }}>
          Tu cuenta no tiene un rol habilitado para esta app todavía.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.base }}>
      {available.length > 1 && (
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, paddingTop: insets.top + 8, paddingBottom: 8 }}>
          {available.map((target) => (
            <Pressable
              key={target}
              onPress={() => setSelected(target)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: theme.radius.full,
                backgroundColor: target === active ? theme.colors.brand : theme.colors.raised,
              }}
            >
              <Text style={{ color: target === active ? "#fff" : theme.colors.ink, fontWeight: "600" }}>
                {TARGET_LABEL[target]}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      {renderTarget(active)}
    </View>
  );
}
