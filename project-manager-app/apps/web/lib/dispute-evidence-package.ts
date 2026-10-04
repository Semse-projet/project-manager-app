export type DisputePackageFile = {
  name: string;
  size: number;
  type: string;
};

export type DisputePackageUploadInput = {
  domain: "dispute";
  filename: string;
  contentType: string;
  fileSizeBytes: number;
  source: "local_device";
};

export function buildDisputePackageUploadInput(
  file: DisputePackageFile,
): DisputePackageUploadInput {
  if (!file.name.trim()) {
    throw new Error("Selecciona un archivo con nombre válido.");
  }
  if (!Number.isSafeInteger(file.size) || file.size <= 0) {
    throw new Error("El paquete seleccionado está vacío o tiene un tamaño inválido.");
  }

  return {
    domain: "dispute",
    filename: file.name,
    contentType: file.type || "application/octet-stream",
    fileSizeBytes: file.size,
    source: "local_device",
  };
}

export function resolveDisputePackagePlan(
  plan: Record<string, unknown>,
): { key: string; contentType: string } {
  const strategy = typeof plan.recommendedStrategy === "string"
    ? plan.recommendedStrategy
    : "single_put";
  if (strategy !== "single_put") {
    throw new Error(
      "Este paquete supera el límite de subida directa (~25 MB). Usa un archivo más pequeño o divídelo; la transferencia multipart aún no envía bytes reales.",
    );
  }

  const key = typeof plan.key === "string" ? plan.key.trim() : "";
  if (!key) {
    throw new Error("El plan de subida no devolvió una clave de almacenamiento válida.");
  }

  return {
    key,
    contentType: typeof plan.contentType === "string" && plan.contentType.trim()
      ? plan.contentType
      : "application/octet-stream",
  };
}

export function disputePackageProxyUrl(key: string): string {
  return `/api/semse/uploads/files/${encodeURIComponent(key)}`;
}
