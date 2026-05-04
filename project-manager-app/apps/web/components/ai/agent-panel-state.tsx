"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type PanelAgentId = "assistant" | "marta" | "felix" | "pulse" | "justus" | "planner";
export type AgentPanelMode = "idle" | "open" | "minimized";

type AgentPanelStateValue = {
  selectedAgentId: PanelAgentId;
  activeConversationId: string | null;
  agentPanelMode: AgentPanelMode;
  selectedProjectId: string | null;
  setSelectedAgentId: (agentId: PanelAgentId) => void;
  setActiveConversationId: (conversationId: string | null) => void;
  setSelectedProjectId: (projectId: string | null) => void;
  openPanel: (agentId?: PanelAgentId) => void;
  closePanel: () => void;
  minimizePanel: () => void;
};

const AgentPanelStateContext = createContext<AgentPanelStateValue | null>(null);

export function AgentPanelStateProvider({ children }: { children: ReactNode }) {
  const [selectedAgentId, setSelectedAgentId] = useState<PanelAgentId>("assistant");
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [agentPanelMode, setAgentPanelMode] = useState<AgentPanelMode>("idle");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const value = useMemo<AgentPanelStateValue>(() => ({
    selectedAgentId,
    activeConversationId,
    agentPanelMode,
    selectedProjectId,
    setSelectedAgentId,
    setActiveConversationId,
    setSelectedProjectId,
    openPanel: (agentId) => {
      if (agentId) setSelectedAgentId(agentId);
      setAgentPanelMode("open");
    },
    closePanel: () => setAgentPanelMode("idle"),
    minimizePanel: () => setAgentPanelMode("minimized"),
  }), [activeConversationId, agentPanelMode, selectedAgentId, selectedProjectId]);

  return (
    <AgentPanelStateContext.Provider value={value}>
      {children}
    </AgentPanelStateContext.Provider>
  );
}

export function useAgentPanelState(): AgentPanelStateValue {
  const value = useContext(AgentPanelStateContext);
  if (!value) {
    throw new Error("useAgentPanelState must be used within AgentPanelStateProvider");
  }
  return value;
}
