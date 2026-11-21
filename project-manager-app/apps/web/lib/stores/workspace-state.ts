import type {
  LoadMissionRequest, MissionLoadResponse, MissionUnloadResponse, NavigationUpdateResponse,
  UpdateNavigationRequest, WorkspaceActiveMission, WorkspaceContextResponse,
  WorkspaceMissionType, WorkspaceRightPanelMode,
} from "@semse/schemas";

export type WorkspaceOperation = "refresh" | "navigate" | "load" | "unload";
export type WorkspaceStoreState = {
  loading: boolean;
  pending: WorkspaceOperation | null;
  error: string | null;
  context: WorkspaceContextResponse | null;
  activeSection: string;
  navigationHistory: string[];
  activeMission: WorkspaceActiveMission | null;
  rightPanelMode: WorkspaceRightPanelMode;
  scopeVersion: number;
  sessionUnavailable: boolean;
};
export type WorkspaceApi = {
  getContext: () => Promise<WorkspaceContextResponse>;
  navigate: (input: UpdateNavigationRequest) => Promise<NavigationUpdateResponse>;
  loadMission: (input: LoadMissionRequest) => Promise<MissionLoadResponse>;
  unloadMission: (id: string) => Promise<MissionUnloadResponse>;
};

function initialState(scopeVersion = 0): WorkspaceStoreState {
  return { loading: false, pending: null, error: null, context: null, activeSection: "home", navigationHistory: ["home"], activeMission: null, rightPanelMode: "operational", scopeVersion, sessionUnavailable: false };
}
function contextIdentity(context: WorkspaceContextResponse | null): string {
  return context ? JSON.stringify([context.tenantId, context.organizationId, context.userId, [...context.permissions].sort()]) : "";
}

/** Coordinates confirmed presentation state; it never authorizes a resource. */
export function createWorkspaceStore(api: WorkspaceApi) {
  const serverSnapshot = initialState();
  let state = serverSnapshot;
  let epoch = 0;
  let activePromise: Promise<boolean> | null = null;
  const listeners = new Set<() => void>();
  function setState(patch: Partial<WorkspaceStoreState>) {
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  }
  function applyContext(context: WorkspaceContextResponse) {
    const scopeChanged = contextIdentity(context) !== contextIdentity(state.context);
    setState({ context, activeSection: context.leftPanelState.activeSection, navigationHistory: context.leftPanelState.navigationHistory, activeMission: context.activeMission, rightPanelMode: context.rightPanelState.mode, error: null, sessionUnavailable: false, scopeVersion: state.scopeVersion + Number(scopeChanged) });
  }
  function invalidateSession(message = "La sesión no está disponible. Vuelve a iniciar sesión. (401)") {
    epoch += 1;
    activePromise = null;
    setState({ context: null, activeMission: null, rightPanelMode: "operational", pending: null, loading: false, error: message, sessionUnavailable: true, scopeVersion: state.scopeVersion + 1 });
  }
  function perform(operation: WorkspaceOperation, task: () => Promise<void>): Promise<boolean> {
    if (state.pending) return Promise.resolve(false);
    const version = epoch;
    setState({ pending: operation, loading: operation === "refresh", error: null });
    const promise = Promise.resolve().then(async () => {
      if (version !== epoch) return false;
      try {
        await task();
        return version === epoch;
      } catch (error) {
        if (version === epoch) {
          const message = error instanceof Error ? error.message : "No se pudo completar la solicitud del workspace.";
          const status = typeof error === "object" && error !== null && "status" in error ? error.status : null;
          if (status === 401 || /\b401\b/.test(message)) invalidateSession(message);
          else setState({ error: message });
        }
        return false;
      } finally {
        if (version === epoch) {
          activePromise = null;
          setState({ pending: null, loading: false });
        }
      }
    });
    activePromise = promise;
    return promise;
  }
  function refresh(): Promise<boolean> {
    if (state.pending === "refresh" && activePromise) return activePromise;
    if (activePromise) {
      const version = epoch;
      return activePromise.then(() => version === epoch ? refresh() : false);
    }
    const version = epoch;
    return perform("refresh", async () => {
      const context = await api.getContext();
      if (version === epoch) applyContext(context);
    });
  }
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot: () => state,
    getServerSnapshot: () => serverSnapshot,
    refresh,
    invalidateSession,
    navigate(section: string, mode?: WorkspaceRightPanelMode): Promise<boolean> {
      if (!state.context || !section.trim()) return Promise.resolve(false);
      const version = epoch;
      return perform("navigate", async () => {
        const result = await api.navigate({ leftPanelAction: section, rightPanelMode: mode });
        if (version !== epoch || !state.context) return;
        applyContext({ ...state.context, currentScreen: result.leftPanelState.activeSection, leftPanelState: result.leftPanelState, rightPanelState: { mode: mode ?? state.rightPanelMode, content: result.rightPanelContent } });
      });
    },
    loadMission(missionId: string, missionType: WorkspaceMissionType, title?: string): Promise<boolean> {
      if (!state.context) return Promise.resolve(false);
      const version = epoch;
      return perform("load", async () => {
        const result = await api.loadMission({ missionId, missionType, title });
        if (version !== epoch || !state.context) return;
        applyContext({ ...state.context, activeMission: { missionId: result.missionId, missionType: result.missionType, title: result.title }, rightPanelState: { mode: result.rightPanelMode, content: result.context } });
      });
    },
    unloadMission(missionId: string): Promise<boolean> {
      if (!state.context || state.activeMission?.missionId !== missionId) return Promise.resolve(false);
      const version = epoch;
      return perform("unload", async () => {
        await api.unloadMission(missionId);
        if (version !== epoch || !state.context) return;
        applyContext({ ...state.context, activeMission: null, rightPanelState: { mode: "operational", content: null } });
      });
    },
    reset() {
      epoch += 1;
      activePromise = null;
      state = initialState(state.scopeVersion + 1);
      for (const listener of listeners) listener();
    },
  };
}
