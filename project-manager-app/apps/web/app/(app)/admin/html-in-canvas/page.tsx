"use client";

import { useEffect, useRef, useState } from "react";
import { HtmlInCanvasPanel, useHtmlInCanvasSupport, type HtmlInCanvasPanelHandle } from "@semse/ui";
import { CheckCircle, Copy, Layers } from "lucide-react";
import { AdminPageHeader } from "../../../../components/admin/AdminPageHeader";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <pre
        style={{
          margin: 0,
          padding: "16px",
          borderRadius: "14px",
          background: "rgba(15,23,42,0.6)",
          overflowX: "auto",
          whiteSpace: "pre-wrap",
          color: "#e2e8f0",
          fontSize: "0.82rem",
          lineHeight: 1.7,
          border: "1px solid rgba(255,255,255,0.06)"
        }}
      >
        {code}
      </pre>
      <button
        type="button"
        onClick={() => void copy()}
        style={{
          position: "absolute",
          top: "10px",
          right: "10px",
          padding: "6px 10px",
          borderRadius: "10px",
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.06)",
          color: copied ? "#34d399" : "#94a3b8",
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          fontSize: "0.78rem",
          fontWeight: 700
        }}
      >
        <Copy size={12} />
        {copied ? "Copiado" : "Copiar"}
      </button>
    </div>
  );
}

function SupportBanner({ supported }: { supported: boolean }) {
  return (
    <div
      style={{
        padding: "16px 20px",
        borderRadius: "18px",
        border: `1px solid ${supported ? "rgba(52,211,153,0.3)" : "rgba(245,158,11,0.3)"}`,
        background: supported ? "rgba(16,185,129,0.08)" : "rgba(245,158,11,0.08)",
        display: "flex",
        alignItems: "center",
        gap: "14px"
      }}
    >
      {supported ? <CheckCircle size={20} color="#34d399" /> : <Layers size={20} color="#f59e0b" />}
      <div>
        <div style={{ fontWeight: 800, color: supported ? "#34d399" : "#f59e0b", fontSize: "0.95rem" }}>
          {supported ? "HTML-in-Canvas activo en este navegador" : "Modo fallback DOM activo"}
        </div>
        <div style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: "4px" }}>
          {supported
            ? "drawElementImage y requestPaint detectados. Las demos de abajo renderizan HTML real en canvas."
            : "La demo funciona con DOM y exportación PNG. Activa chrome://flags/#canvas-draw-element en Chromium compatible para probar el render nativo."}
        </div>
      </div>
    </div>
  );
}

function HelloWorldDemo() {
  return (
    <div>
      <h3 style={{ marginTop: 0, marginBottom: "14px", fontSize: "1rem", fontWeight: 800 }}>1 — Hello World</h3>
      <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: "16px" }}>
        El caso base: un <code style={{ background: "rgba(255,255,255,0.07)", padding: "2px 6px", borderRadius: "6px" }}>div</code> con
        estilos plenos dibujado en canvas con <code style={{ background: "rgba(255,255,255,0.07)", padding: "2px 6px", borderRadius: "6px" }}>drawElementImage</code>.
      </p>
      <HtmlInCanvasPanel
        style={{
          padding: "28px",
          borderRadius: "18px",
          background: "linear-gradient(135deg, rgba(59,130,246,0.15), rgba(167,139,250,0.15))",
          border: "1px solid rgba(96,165,250,0.2)",
          textAlign: "center"
        }}
        canvasClassName="rounded-[18px]"
        minHeight={100}
      >
        <div
          style={{
            fontSize: "2rem",
            fontWeight: 900,
            background: "linear-gradient(135deg, #60a5fa, #a78bfa)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent"
          }}
        >
          Hola desde Canvas
        </div>
        <div style={{ color: "var(--muted)", marginTop: "8px", fontSize: "0.9rem" }}>
          Este texto usa gradiente CSS real, renderizado por el navegador en un elemento canvas.
        </div>
      </HtmlInCanvasPanel>
      <div style={{ marginTop: "14px" }}>
        <CodeBlock code={`<canvas layoutsubtree>
  <div style={{ background: "linear-gradient(...)", ... }}>
    Hola desde Canvas
  </div>
</canvas>

// En el loop de paint:
ctx.drawElementImage(contentDiv, 0, 0);`} />
      </div>
    </div>
  );
}

function LiveCounterDemo() {
  const [count, setCount] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setCount((c) => c + 1), 100);
    return () => clearInterval(id);
  }, [running]);

  return (
    <div>
      <h3 style={{ marginTop: 0, marginBottom: "14px", fontSize: "1rem", fontWeight: 800 }}>2 — Contenido en tiempo real</h3>
      <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: "16px" }}>
        HTML-in-Canvas se resincroniza con el DOM en cada frame mediante <code style={{ background: "rgba(255,255,255,0.07)", padding: "2px 6px", borderRadius: "6px" }}>MutationObserver</code> + <code style={{ background: "rgba(255,255,255,0.07)", padding: "2px 6px", borderRadius: "6px" }}>requestPaint</code>.
        El contador actualiza el canvas 10 veces por segundo.
      </p>
      <HtmlInCanvasPanel
        style={{
          padding: "28px",
          borderRadius: "18px",
          background: "rgba(15,23,42,0.4)",
          border: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: "24px"
        }}
        canvasClassName="rounded-[18px]"
        minHeight={80}
      >
        <div
          style={{
            fontSize: "3rem",
            fontWeight: 900,
            fontVariantNumeric: "tabular-nums",
            color: count > 0 ? "#34d399" : "var(--muted)",
            minWidth: "5ch",
            textAlign: "right"
          }}
        >
          {count.toLocaleString()}
        </div>
        <div style={{ display: "grid", gap: "8px" }}>
          <button
            type="button"
            onClick={() => setRunning((r) => !r)}
            style={{
              padding: "10px 18px",
              borderRadius: "12px",
              border: "none",
              background: running ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)",
              color: running ? "#f87171" : "#34d399",
              fontWeight: 800,
              cursor: "pointer"
            }}
          >
            {running ? "Pausar" : "Iniciar"}
          </button>
          <button
            type="button"
            onClick={() => { setCount(0); setRunning(false); }}
            style={{
              padding: "10px 18px",
              borderRadius: "12px",
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--muted)",
              fontWeight: 700,
              cursor: "pointer"
            }}
          >
            Reset
          </button>
        </div>
      </HtmlInCanvasPanel>
      <div style={{ marginTop: "14px" }}>
        <CodeBlock code={`// El componente observa cambios DOM:
mutationObserver.observe(contentNode, {
  subtree: true, childList: true,
  attributes: true, characterData: true,
});

// Cada mutación programa un repaint:
surface.requestPaint?.();
window.requestAnimationFrame(draw);`} />
      </div>
    </div>
  );
}

function CssEffectsDemo() {
  const [hovered, setHovered] = useState<number | null>(null);

  const cards = [
    { label: "Branch", value: "feat/html-canvas", color: "#60a5fa", bg: "rgba(59,130,246,0.12)" },
    { label: "Status", value: "COMPLETED", color: "#34d399", bg: "rgba(16,185,129,0.12)" },
    { label: "Stage", value: "PR", color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  ];

  return (
    <div>
      <h3 style={{ marginTop: 0, marginBottom: "14px", fontSize: "1rem", fontWeight: 800 }}>3 — CSS completo: sombras, tipografía, layout</h3>
      <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: "16px" }}>
        El navegador renderiza el CSS real: <code style={{ background: "rgba(255,255,255,0.07)", padding: "2px 6px", borderRadius: "6px" }}>box-shadow</code>, subpíxeles, RTL, ligaduras.
        Sin html2canvas, sin capturas de pantalla.
      </p>
      <HtmlInCanvasPanel
        style={{
          padding: "20px",
          borderRadius: "18px",
          background: "rgba(15,23,42,0.4)",
          border: "1px solid var(--border)",
          display: "flex",
          gap: "14px",
          flexWrap: "wrap"
        }}
        canvasClassName="rounded-[18px]"
        minHeight={100}
      >
        {cards.map((card, index) => (
          <div
            key={card.label}
            onMouseEnter={() => setHovered(index)}
            onMouseLeave={() => setHovered(null)}
            style={{
              padding: "16px 20px",
              borderRadius: "14px",
              background: card.bg,
              border: `1px solid ${card.color}44`,
              boxShadow: hovered === index ? `0 8px 24px ${card.color}22` : "none",
              transition: "box-shadow 0.2s",
              minWidth: "120px"
            }}
          >
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {card.label}
            </div>
            <div style={{ marginTop: "6px", fontWeight: 800, color: card.color, fontSize: "0.95rem" }}>
              {card.value}
            </div>
          </div>
        ))}
      </HtmlInCanvasPanel>
      <div style={{ marginTop: "14px" }}>
        <CodeBlock code={`// CSS real: sombras, opacidad, transforms
<div style={{
  boxShadow: "0 8px 24px rgba(96,165,250,0.13)",
  transition: "box-shadow 0.2s",
  borderRadius: "14px",
}}>
  Renderizado en canvas sin polyfills
</div>`} />
      </div>
    </div>
  );
}

function ExportDemo() {
  const panelRef = useRef<HtmlInCanvasPanelHandle | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [noSupport, setNoSupport] = useState(false);

  async function exportPng() {
    if (!panelRef.current) return;
    setExporting(true);
    setNoSupport(false);

    // En modo nativo capture() usa el canvas. En fallback captura el DOM visible como PNG.
    const blob = await panelRef.current.capture();

    if (!blob) {
      setNoSupport(true);
      setExporting(false);
      return;
    }

    const prev = exportUrl;
    const url = URL.createObjectURL(blob);
    setExportUrl(url);
    setExporting(false);

    if (prev) URL.revokeObjectURL(prev);
  }

  return (
    <div>
      <h3 style={{ marginTop: 0, marginBottom: "14px", fontSize: "1rem", fontWeight: 800 }}>4 — Exportar HTML como PNG</h3>
      <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: "16px" }}>
        Reemplazo nativo de <code style={{ background: "rgba(255,255,255,0.07)", padding: "2px 6px", borderRadius: "6px" }}>html2canvas</code>.
        Con soporte nativo, el contenido vive dentro del canvas con <code style={{ background: "rgba(255,255,255,0.07)", padding: "2px 6px", borderRadius: "6px" }}>layoutsubtree</code>
        y <code style={{ background: "rgba(255,255,255,0.07)", padding: "2px 6px", borderRadius: "6px" }}>canvas.toBlob()</code>. Sin soporte nativo, SEMSE usa un fallback DOM para generar el PNG.
      </p>
      <HtmlInCanvasPanel
        ref={panelRef}
        style={{
          padding: "28px",
          borderRadius: "18px",
          background: "linear-gradient(135deg, #1e1b4b, #0f172a)",
          border: "1px solid rgba(167,139,250,0.2)",
          textAlign: "center"
        }}
        canvasClassName="rounded-[18px]"
        minHeight={120}
      >
        <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "#a78bfa" }}>SEMSE OS</div>
        <div style={{ color: "#64748b", marginTop: "8px", fontSize: "0.85rem" }}>HTML-in-Canvas — Export Demo</div>
        <div style={{ marginTop: "14px", display: "inline-flex", gap: "10px" }}>
          {["branch", "change", "commit", "push", "PR"].map((s) => (
            <span
              key={s}
              style={{
                padding: "4px 10px",
                borderRadius: "999px",
                background: "rgba(167,139,250,0.15)",
                color: "#a78bfa",
                fontSize: "0.78rem",
                fontWeight: 800
              }}
            >
              {s}
            </span>
          ))}
        </div>
      </HtmlInCanvasPanel>
      <div style={{ marginTop: "14px", display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => void exportPng()}
          disabled={exporting}
          style={{
            padding: "10px 18px",
            borderRadius: "12px",
            border: "none",
            background: "rgba(167,139,250,0.2)",
            color: "#a78bfa",
            fontWeight: 800,
            cursor: exporting ? "not-allowed" : "pointer",
            opacity: exporting ? 0.6 : 1
          }}
        >
          {exporting ? "Exportando..." : "Exportar como PNG"}
        </button>
        {exportUrl && (
          <a
            href={exportUrl}
            download="semse-export.png"
            style={{ color: "#34d399", fontSize: "0.9rem", textDecoration: "underline" }}
          >
            Descargar PNG
          </a>
        )}
        {noSupport && (
          <span style={{ color: "#f87171", fontSize: "0.85rem" }}>
            No se pudo generar el PNG en este navegador.
          </span>
        )}
      </div>
      <div style={{ marginTop: "14px" }}>
        <CodeBlock code={`// Con soporte nativo, el contenido vive dentro del layoutsubtree canvas.
// Sin soporte nativo, capture() serializa el DOM visible y devuelve un PNG.
const blob = await panelRef.current.capture();
const url = URL.createObjectURL(blob);
// link.download = "export.png"; link.click();

// Sin html2canvas. Sin servicios externos. Privacidad preservada.`} />
      </div>
    </div>
  );
}

export default function AdminHtmlInCanvasPage() {
  const supported = useHtmlInCanvasSupport();

  return (
    <main style={{ padding: "32px", color: "var(--ink)", maxWidth: "860px", margin: "0 auto" }}>
      <AdminPageHeader
        title="HTML-in-Canvas Demo"
        subtitle="Consola de pruebas aislada — WICG spec · Chromium 147+"
        icon={Layers}
        iconColor="#a78bfa"
        iconBg="rgba(167,139,250,.15)"
        showBack={false}
        actions={
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <NotificationBanner audience="admin" />
            <SupportBanner supported={supported} />
          </div>
        }
      />

      <div style={{ display: "grid", gap: "32px" }}>
        <section
          style={{
            border: "1px solid var(--border)",
            borderRadius: "24px",
            background: "var(--surface)",
            padding: "24px"
          }}
        >
          <HelloWorldDemo />
        </section>

        <section
          style={{
            border: "1px solid var(--border)",
            borderRadius: "24px",
            background: "var(--surface)",
            padding: "24px"
          }}
        >
          <LiveCounterDemo />
        </section>

        <section
          style={{
            border: "1px solid var(--border)",
            borderRadius: "24px",
            background: "var(--surface)",
            padding: "24px"
          }}
        >
          <CssEffectsDemo />
        </section>

        <section
          style={{
            border: "1px solid var(--border)",
            borderRadius: "24px",
            background: "var(--surface)",
            padding: "24px"
          }}
        >
          <ExportDemo />
        </section>

        <section
          style={{
            border: "1px solid var(--border)",
            borderRadius: "24px",
            background: "var(--surface)",
            padding: "24px"
          }}
        >
          <h3 style={{ marginTop: 0, fontSize: "1rem", fontWeight: 800 }}>API Reference rápida</h3>
          <div style={{ display: "grid", gap: "12px" }}>
            {[
              {
                name: "layoutsubtree",
                type: "atributo HTML",
                desc: "Agrega al canvas. Sus hijos participan en layout normal pero permanecen invisibles hasta que se dibujan.",
                color: "#60a5fa"
              },
              {
                name: "ctx.drawElementImage(el, x, y)",
                type: "método",
                desc: "Dibuja el elemento hijo con sus estilos CSS completos. Funciona en 2D, WebGL y WebGPU.",
                color: "#34d399"
              },
              {
                name: "canvas.requestPaint()",
                type: "método",
                desc: "Señala al navegador que debe disparar el evento paint en el próximo frame.",
                color: "#a78bfa"
              },
              {
                name: "canvas.onpaint",
                type: "evento",
                desc: "Se dispara cuando el renderizado del subtree cambia. Ideal para sincronizar el redibujado.",
                color: "#f59e0b"
              }
            ].map((item) => (
              <div
                key={item.name}
                style={{
                  padding: "14px 16px",
                  borderRadius: "14px",
                  border: `1px solid ${item.color}22`,
                  background: `${item.color}08`,
                  display: "grid",
                  gap: "4px"
                }}
              >
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <code style={{ fontWeight: 800, color: item.color, fontSize: "0.88rem" }}>{item.name}</code>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      padding: "2px 8px",
                      borderRadius: "999px",
                      background: `${item.color}18`,
                      color: item.color,
                      fontWeight: 700
                    }}
                  >
                    {item.type}
                  </span>
                </div>
                <div style={{ fontSize: "0.88rem", color: "var(--muted)" }}>{item.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: "16px" }}>
            <a
              href="https://github.com/WICG/html-in-canvas"
              target="_blank"
              rel="noreferrer"
              style={{ color: "#60a5fa", fontSize: "0.9rem", textDecoration: "underline" }}
            >
              WICG/html-in-canvas en GitHub
            </a>
            {" · "}
            <a
              href="https://html-in-canvas.dev/docs/api-reference/"
              target="_blank"
              rel="noreferrer"
              style={{ color: "#60a5fa", fontSize: "0.9rem", textDecoration: "underline" }}
            >
              Especificación completa
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
