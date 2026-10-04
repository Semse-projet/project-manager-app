export type MaterialRequestStatus =
  | "pending"
  | "approved"
  | "delivered"
  | "rejected";

type MaterialStatusMeta = {
  variant: "warning" | "success" | "info" | "error";
  label: string;
};

export const MATERIAL_REQUEST_STATUS_META: Record<
  MaterialRequestStatus,
  MaterialStatusMeta
> = {
  pending: { variant: "warning", label: "Pendiente" },
  approved: { variant: "info", label: "Aprobado" },
  delivered: { variant: "success", label: "Entregado" },
  rejected: { variant: "error", label: "Rechazado" },
};

export function parsePositiveMaterialQuantity(value: string): number | null {
  if (value.trim() === "") return null;

  const quantity = Number(value);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : null;
}
