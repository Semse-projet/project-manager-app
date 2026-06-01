import type { ValidationIssue, ValidationSeverity } from "./types.js";

export function required(field: string, value: unknown): ValidationIssue | null {
  if (value === null || value === undefined || value === "") {
    return { field, severity: "error", message: `${field} es requerido.` };
  }
  return null;
}

export function positive(field: string, value: number, label = field): ValidationIssue | null {
  if (!Number.isFinite(value)) {
    return { field, severity: "error", message: `${label} debe ser un número válido.` };
  }
  if (value <= 0) {
    return { field, severity: "error", message: `${label} debe ser mayor a 0.` };
  }
  return null;
}

export function range(
  field: string, value: number, min: number, max: number, label = field
): ValidationIssue | null {
  if (!Number.isFinite(value)) {
    return {
      field,
      severity: "error",
      message: `${label} debe ser un número válido.`,
      suggestion: `Valor actual: ${String(value)}`,
    };
  }
  if (value < min || value > max) {
    return {
      field,
      severity: "error",
      message: `${label} debe estar entre ${min} y ${max}.`,
      suggestion: `Valor actual: ${value}`,
    };
  }
  return null;
}

export function warn(field: string, message: string, suggestion?: string): ValidationIssue {
  return { field, severity: "warning" as ValidationSeverity, message, suggestion };
}

export function info(field: string, message: string): ValidationIssue {
  return { field, severity: "info" as ValidationSeverity, message };
}

export function collect(...results: (ValidationIssue | null)[]): ValidationIssue[] {
  return results.filter((r): r is ValidationIssue => r !== null);
}

export function isValid(issues: ValidationIssue[]): boolean {
  return !issues.some((i) => i.severity === "error");
}
