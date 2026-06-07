"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { getInvoicePdfUrl } from "../../app/semse-api";

interface Props {
  invoiceId: string;
  docType?: "estimate" | "invoice";
  label?: string;
}

export function DownloadPdfButton({ invoiceId, docType, label }: Props) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      const url = getInvoicePdfUrl(invoiceId, docType);
      const res = await fetch(url);
      if (!res.ok) throw new Error("PDF generation failed");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(cd);
      a.download = match?.[1] ?? `document-${invoiceId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <button
      onClick={() => void handleDownload()}
      disabled={downloading}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        borderRadius: 8,
        border: "1px solid var(--border)",
        background: "var(--surface)",
        color: downloading ? "var(--muted)" : "var(--ink)",
        fontSize: 12,
        fontWeight: 600,
        cursor: downloading ? "not-allowed" : "pointer",
        transition: "opacity 0.15s",
      }}
    >
      {downloading
        ? <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
        : <Download size={13} />}
      {label ?? (docType === "estimate" ? "Descargar Estimado" : "Descargar Factura")}
    </button>
  );
}
