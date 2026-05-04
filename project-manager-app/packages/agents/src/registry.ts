import type { RuntimeAgentInput, RuntimeAgentResult, RuntimeAgentRole } from "./governance.js";

export interface AgentRegistration {
  role: RuntimeAgentRole;
  description: string;
  toolsAllowed: string[];
  allowsSubdelegation: boolean;
  handler: (input: RuntimeAgentInput) => RuntimeAgentResult;
}

const _entries = new Map<string, AgentRegistration>();

function register(reg: AgentRegistration): void {
  if (_entries.has(reg.role)) {
    throw new Error(`AgentRegistry: duplicate registration for role "${reg.role}"`);
  }
  _entries.set(reg.role, reg);
}

function resolve(role: string): AgentRegistration {
  const entry = _entries.get(role);
  if (!entry) {
    throw new Error(`AgentRegistry: no handler registered for role "${role}"`);
  }
  return entry;
}

function has(role: string): boolean {
  return _entries.has(role);
}

function list(): AgentRegistration[] {
  return Array.from(_entries.values());
}

function roles(): string[] {
  return Array.from(_entries.keys());
}

export const AgentRegistry = { register, resolve, has, list, roles } as const;
