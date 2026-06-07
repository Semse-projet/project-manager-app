"use client";

import { useEffect, useState } from "react";
import { BadgeDollarSign, Check, RefreshCw, Save, Trash2 } from "lucide-react";
import { HtmlInCanvasPanel } from "@semse/ui";
import {
  fetchMyLaborRates,
  saveMyLaborRates,
  deleteMyLaborRates,
  type ContractorRateStatus,
} from "../../../semse-api";

function RateInput({
  label, desc, value, onChange, min, max, step, prefix, suffix,
}: {
  label: string; desc: string;
  value: number; onChange: (v: number) => void;
  min: number; max: number; step: number;
  prefix?: string; suffix?: string;
}) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{label}</div>
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{desc}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {prefix && <span style={{ fontSize: 14, fontWeight: 700, color: "var(--muted)" }}>{prefix}</span>}
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            width: 110, padding: "10px 12px", borderRadius: 10,
            border: "1.5px solid var(--border)", background: "var(--bg)",
            color: "var(--ink)", fontSize: 15, fontWeight: 700,
            outline: "none",
          }}
        />
        {suffix && <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted)" }}>{suffix}</span>}
      </div>
    </div>
  );
}

export default function ContractorRatesPage() {
  const [status, setStatus] = useState<ContractorRateStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [laborRate,     setLaborRate]     = useState(35);
  const [materialMarkup, setMaterialMarkup] = useState(10); // percentage
  const [notes,         setNotes]         = useState("");

  useEffect(() => {
    setLoading(true);
    fetchMyLaborRates()
      .then((s) => {
        setStatus(s);
        if (s.override) {
          setLaborRate(s.override.laborRatePerHr);
          setMaterialMarkup(Math.round(s.override.materialMarkup * 100));
          setNotes(s.override.notes ?? "");
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Error al cargar tarifas."))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await saveMyLaborRates({
        laborRatePerHr: laborRate,
        materialMarkup: materialMarkup / 100,
        notes: notes.trim() || undefined,
      });
      setStatus((prev) => prev ? { ...prev, override: res.override, hasCustomRates: true } : prev);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function revertToBls() {
    setDeleting(true);
    setError(null);
    try {
      await deleteMyLaborRates();
      setStatus((prev) => prev ? { ...prev, override: null, hasCustomRates: false } : prev);
      setLaborRate(35);
      setMaterialMarkup(10);
      setNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al restaurar.");
    } finally {
      setDeleting(false);
    }
  }

  const card: React.CSSProperties = {
    border: "1px solid var(--border)", borderRadius: 16,
    background: "var(--surface)", padding: "20px 22px",
  };

  const baseline = status?.nationalBaselineHourlyRate ?? 24.43;
  const derivedLaborMult = Math.round((laborRate / baseline) * 100) / 100;
  const derivedMatMult   = Math.round((1 + materialMarkup / 100) * 100) / 100;

  if (loading) {
    return (
      <div style={{ maxWidth: 580, margin: "0 auto", padding: "40px 0", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
        Cargando tarifas…
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 580, margin: "0 auto", display: "grid", gap: 16 }}>

      {/* Header */}
      <div style={{ ...card, display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 42, height: 42, borderRadius: 14, background: "rgba(16,185,129,.15)", display: "grid", placeItems: "center" }}>
          <BadgeDollarSign size={20} color="#10b981" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "var(--ink)" }}>Mis Tarifas</h1>
          <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
            Tus tarifas reales reemplazan los promedios BLS en cada estimado
          </p>
        </div>
        {status?.hasCustomRates && (
          <span style={{ marginLeft: "auto", fontSize: 10, padding: "4px 10px", borderRadius: 20, background: "rgba(16,185,129,.12)", color: "#10b981", fontWeight: 800 }}>
            Activas
          </span>
        )}
      </div>

      {error && (
        <div style={{ padding: "12px 16px", background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.18)", borderRadius: 12, color: "#ef4444", fontSize: 13 }}>
          {error}
        </div>
      )}

      {saved && (
        <div style={{ padding: "12px 16px", background: "rgba(16,185,129,.08)", border: "1px solid rgba(16,185,129,.22)", borderRadius: 12, color: "#10b981", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          <Check size={14} /> Tarifas guardadas. Se usarán en todos los estimados futuros.
        </div>
      )}

      {/* BLS reference */}
      <HtmlInCanvasPanel style={{ ...card, background: "rgba(99,102,241,.03)" }} minHeight={50}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(99,102,241,.1)", display: "grid", placeItems: "center" }}>
            <RefreshCw size={13} color="#818cf8" />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>
              Promedio nacional BLS OEWS 2023
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>
              ${baseline.toFixed(2)}/hr promedio de 12 oficios de construcción
              {status?.hasCustomRates ? " — reemplazado por tus tarifas" : " — se usa si no hay override"}
            </div>
          </div>
        </div>
      </HtmlInCanvasPanel>

      {/* Labor rate */}
      <HtmlInCanvasPanel style={card} minHeight={80}>
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)", textTransform: "uppercase", letterSpacing: ".06em" }}>
            Tarifa de Mano de Obra
          </div>
          <RateInput
            label="Mi tarifa por hora"
            desc="Lo que realmente cobras por hora de trabajo en campo"
            value={laborRate}
            onChange={setLaborRate}
            min={10}
            max={250}
            step={0.5}
            prefix="$"
            suffix="/ hr"
          />
          <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(99,102,241,.06)", fontSize: 12, color: "var(--ink)" }}>
            Multiplicador aplicado: <strong style={{ color: "#818cf8" }}>{derivedLaborMult}×</strong>
            {" "}vs. promedio nacional (${ baseline.toFixed(2)}/hr)
          </div>
        </div>
      </HtmlInCanvasPanel>

      {/* Material markup */}
      <HtmlInCanvasPanel style={card} minHeight={80}>
        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--ink)", textTransform: "uppercase", letterSpacing: ".06em" }}>
            Markup de Materiales
          </div>
          <RateInput
            label="Porcentaje de markup"
            desc="Margen adicional sobre el costo de materiales (overhead, ganancia, merma)"
            value={materialMarkup}
            onChange={setMaterialMarkup}
            min={0}
            max={100}
            step={1}
            suffix="%"
          />
          <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(16,185,129,.06)", fontSize: 12, color: "var(--ink)" }}>
            Factor aplicado: <strong style={{ color: "#10b981" }}>{derivedMatMult}×</strong>
            {" "}sobre el costo base de materiales BLS
          </div>
        </div>
      </HtmlInCanvasPanel>

      {/* Notes */}
      <HtmlInCanvasPanel style={card} minHeight={60}>
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Notas (opcional)</div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej: Tarifa actualizada por nuevo convenio colectivo, incluye seguro y equipo…"
            rows={3}
            style={{
              width: "100%", padding: "10px 12px", borderRadius: 10,
              border: "1.5px solid var(--border)", background: "var(--bg)",
              color: "var(--ink)", fontSize: 13, resize: "vertical",
              boxSizing: "border-box",
            }}
          />
        </div>
      </HtmlInCanvasPanel>

      {/* Actions */}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={() => void save()}
          disabled={saving || loading}
          style={{
            flex: 1, padding: "13px 24px", borderRadius: 12, border: "none",
            background: saving ? "var(--border)" : "linear-gradient(135deg,#10b981,#059669)",
            color: "#fff", fontSize: 14, fontWeight: 800,
            cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          <Save size={15} />
          {saving ? "Guardando…" : "Guardar mis tarifas"}
        </button>

        {status?.hasCustomRates && (
          <button
            onClick={() => void revertToBls()}
            disabled={deleting}
            title="Eliminar override y volver a promedios BLS"
            style={{
              padding: "13px 18px", borderRadius: 12, border: "1.5px solid var(--border)",
              background: "transparent", color: "var(--muted)", fontSize: 13, fontWeight: 700,
              cursor: deleting ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <Trash2 size={14} />
            {deleting ? "Restaurando…" : "Usar BLS"}
          </button>
        )}
      </div>

      <div style={{ fontSize: 11, color: "var(--faint)", textAlign: "center" }}>
        {status?.override?.updatedAt
          ? `Última actualización: ${new Date(status.override.updatedAt).toLocaleString("es-MX")}`
          : "Sin tarifas guardadas — los estimados usan promedios BLS OEWS."}
      </div>
    </div>
  );
}
