import type { ConnectorStatus, TrustLevel } from './contracts.js';

export const TRUST_LEVEL_ORDER: Readonly<Record<TrustLevel, number>> = {
  UNVERIFIED: 0,
  VERIFIED: 1,
  CERTIFIED: 2,
  HIGH_ASSURANCE: 3,
};

export function isExecutableConnectorStatus(status: ConnectorStatus): boolean {
  return status === 'ACTIVE';
}

export function satisfiesTrustLevel(actual: TrustLevel, minimum: TrustLevel): boolean {
  return TRUST_LEVEL_ORDER[actual] >= TRUST_LEVEL_ORDER[minimum];
}

export function exceedsRiskBudget(
  budget: { maxActions?: number; maxRecords?: number; maxCostUsd?: number } | undefined,
  usage: { actions?: number; records?: number; costUsd?: number } | undefined,
): boolean {
  if (!budget || !usage) return false;
  if (budget.maxActions !== undefined && (usage.actions ?? 0) > budget.maxActions) return true;
  if (budget.maxRecords !== undefined && (usage.records ?? 0) > budget.maxRecords) return true;
  if (budget.maxCostUsd !== undefined && (usage.costUsd ?? 0) > budget.maxCostUsd) return true;
  return false;
}
