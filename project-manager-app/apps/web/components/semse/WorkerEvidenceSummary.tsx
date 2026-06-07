"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Camera, CheckCircle2 } from "lucide-react";

type EvidenceItem = { status: string; label: string; jobId?: string };

/** Fetches missing evidence items across active worker jobs and shows a summary badge. */
export function WorkerEvidenceSummary() {
  const [missing, setMissing] = useState<number>(0);
  const [loaded,  setLoaded]  = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/semse/worker/evidence-summary");
      if (!res.ok) return;
      const json = await res.json() as { data: { missingCount: number; totalCount: number } };
      setMissing(json.data?.missingCount ?? 0);
    } catch { /* silent */ } finally { setLoaded(true); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (!loaded) return null;

  if (missing === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "rgba(134,239,172,.06)", border: "1px solid rgba(134,239,172,.2)", borderRadius: 12 }}>
        <CheckCircle2 size={16} color="#86efac" />
        <span style={{ fontSize: 13, fontWeight: 700, color: "#86efac" }}>Evidencia al día — sin items pendientes</span>
      </div>
    );
  }

  return (
    <Link href="/worker/evidence" style={{ textDecoration: "none" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "rgba(234,179,8,.08)", border: "1px solid rgba(234,179,8,.3)", borderRadius: 12, cursor: "pointer", transition: "border-color .2s" }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#fcd34d")}
        onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(234,179,8,.3)")}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(234,179,8,.15)", display: "grid", placeItems: "center", flexShrink: 0, position: "relative" }}>
          <Camera size={16} color="#fcd34d" />
          <span style={{ position: "absolute", top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 99, background: "#ef4444", color: "#fff", fontSize: 9, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>
            {missing}
          </span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#fcd34d" }}>
            {missing} evidencia{missing !== 1 ? "s" : ""} pendiente{missing !== 1 ? "s" : ""}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>
            Sube las fotos requeridas para desbloquear tus pagos → Subir ahora
          </div>
        </div>
        <AlertTriangle size={14} color="#fcd34d" style={{ flexShrink: 0 }} />
      </div>
    </Link>
  );
}
