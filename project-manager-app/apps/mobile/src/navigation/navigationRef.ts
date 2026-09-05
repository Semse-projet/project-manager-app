import { createNavigationContainerRef } from "@react-navigation/native";

/**
 * Untyped on purpose: this ref is used to navigate from outside the React
 * tree (a push-notification tap, see ../notifications/pushResponseHandler.ts)
 * where the target screen can live inside whichever role-specific tab
 * navigator RoleGate mounted (Worker/Client/Admin each have their own,
 * incompatible param lists) — there is no single ParamList that covers all
 * of them from the root.
 */
export const navigationRef = createNavigationContainerRef();
