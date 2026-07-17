export function getPrometeoToolResultDetail(input: {
  outputKind: string;
  summary: string | null;
  errorMessage?: string;
}): string {
  return input.outputKind || input.summary || input.errorMessage || "Sin detalle adicional";
}

export function shouldRenderPrometeoToolError(input: {
  detail: string;
  errorMessage?: string;
}): boolean {
  return Boolean(input.errorMessage && input.detail !== input.errorMessage);
}
