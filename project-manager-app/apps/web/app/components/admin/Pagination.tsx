"use client";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const buttonStyle = (disabled: boolean): React.CSSProperties => ({
    padding: "5px 11px",
    borderRadius: 7,
    border: "1px solid var(--border)",
    background: "var(--surface)",
    color: disabled ? "var(--faint)" : "var(--ink)",
    fontSize: 11,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
  });

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: "1px solid var(--border)" }}>
      <span style={{ fontSize: 11, color: "var(--muted)" }}>
        Página {page + 1} de {totalPages} ({total} total)
      </span>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={() => onPageChange(page - 1)} disabled={page === 0} style={buttonStyle(page === 0)}>
          Anterior
        </button>
        <button type="button" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages - 1} style={buttonStyle(page >= totalPages - 1)}>
          Siguiente
        </button>
      </div>
    </div>
  );
}
