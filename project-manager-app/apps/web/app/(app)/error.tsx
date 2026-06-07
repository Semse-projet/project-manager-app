"use client";

/**
 * (app)/error.tsx — Error boundary for the authenticated app shell
 * Shown when a page throws during render or data fetching
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Log to your observability stack here
    console.error("[SEMSE AppError]", error);
  }, [error]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        textAlign: "center",
        gap: "16px",
        padding: "40px",
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: "64px",
          height: "64px",
          borderRadius: "16px",
          background: "rgba(239,68,68,.12)",
          border: "1px solid rgba(239,68,68,.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "28px",
        }}
      >
        ⚠️
      </div>

      <div>
        <h2
          style={{
            fontSize: "20px",
            fontWeight: 700,
            color: "var(--ink, #f1f5f9)",
            marginBottom: "8px",
          }}
        >
          Algo salió mal
        </h2>
        <p
          style={{
            fontSize: "14px",
            color: "var(--muted, #94a3b8)",
            maxWidth: "360px",
          }}
        >
          {error.message || "Ocurrió un error inesperado al cargar esta página."}
        </p>
        {error.digest && (
          <p style={{ fontSize: "11px", color: "var(--faint, #4b6280)", marginTop: "6px" }}>
            Referencia: {error.digest}
          </p>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "10px" }}>
        <button
          onClick={reset}
          style={{
            padding: "10px 20px",
            borderRadius: "10px",
            background: "var(--brand, #3b82f6)",
            border: "none",
            color: "#fff",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Intentar de nuevo
        </button>
        <button
          onClick={() => router.push("/")}
          style={{
            padding: "10px 20px",
            borderRadius: "10px",
            background: "transparent",
            border: "1px solid var(--border, #1f2d3d)",
            color: "var(--muted, #94a3b8)",
            fontSize: "14px",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Volver al inicio
        </button>
      </div>
    </div>
  );
}
