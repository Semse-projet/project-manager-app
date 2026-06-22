import Link from "next/link";

export const metadata = {
  title: "SEMSE ProTools · Hub",
  description: "22 herramientas de estimación y operaciones para contratistas especializados.",
};

type Tool = {
  id: string;
  label: string;
  desc: string;
  href: string;
  icon: string;
  highlight?: boolean;
};

type Category = {
  id: string;
  label: string;
  color: string;
  bg: string;
  tools: Tool[];
};

const CATEGORIES: Category[] = [
  {
    id: "exterior",
    label: "Exterior & Estructura",
    color: "#3b82f6",
    bg: "#eff6ff",
    tools: [
      { id: "roofing",      label: "Roofing",           desc: "Shingles, felt, flashing, nails, labor y escrow-ready output.",          href: "/tools/roofing",       icon: "🏠", highlight: true },
      { id: "siding",       label: "Siding",             desc: "Exterior cladding con detección de daño oculto y change order prediction.", href: "/tools/siding",        icon: "🏗️" },
      { id: "windows-doors",label: "Windows & Doors",    desc: "Reemplazo, flashing, trim y weatherproofing con cierre de evidencia.",    href: "/tools/windows-doors", icon: "🪟" },
      { id: "deck",         label: "Deck",               desc: "Decking, framing, railing, escaleras y cierre exterior.",                href: "/tools/deck",          icon: "🪵" },
      { id: "fencing",      label: "Fencing",            desc: "Paneles, postes, portones, pendiente y cierre exterior.",                href: "/tools/fencing",       icon: "⛏️" },
      { id: "masonry",      label: "Masonry / Block",    desc: "Block, brick, stone veneer, mortero y cierre exterior.",                 href: "/tools/masonry",       icon: "🧱" },
      { id: "concrete",     label: "Concrete",           desc: "Losas, mezcla, refuerzo y salida friendly para campo.",                  href: "/tools/concrete",      icon: "🏛️" },
    ],
  },
  {
    id: "interior",
    label: "Interior & Acabados",
    color: "#8b5cf6",
    bg: "#faf5ff",
    tools: [
      { id: "drywall",    label: "Drywall",           desc: "Paneles, tornillos, compound, finish level y textura.",                href: "/tools/drywall",    icon: "📋", highlight: true },
      { id: "painting",   label: "Painting",          desc: "Área neta, galones, primer, mano de obra y evidencia.",               href: "/tools/painting",   icon: "🎨" },
      { id: "flooring",   label: "Flooring",          desc: "Área, desperdicio, underlayment, subfloor y evidencia.",              href: "/tools/flooring",   icon: "🪜" },
      { id: "tile",       label: "Tile",              desc: "Layout, waterproofing, grout y evidencia para baños y cocinas.",      href: "/tools/tile",       icon: "🔲" },
      { id: "carpentry",  label: "Carpentry",         desc: "Cabinets, puertas, closets, trim y board-foot takeoff.",              href: "/tools/carpentry",  icon: "🔨" },
      { id: "insulation", label: "Insulation",        desc: "Área, R-value, air sealing y eficiencia energética.",                 href: "/tools/insulation", icon: "🌡️" },
    ],
  },
  {
    id: "mep",
    label: "MEP & Sistemas",
    color: "#f59e0b",
    bg: "#fffbeb",
    tools: [
      { id: "electrical", label: "Electrical",        desc: "Dashboard completo: load analysis, scope, materiales, milestones y RAG.", href: "/tools/electrical/dashboard", icon: "⚡", highlight: true },
      { id: "plumbing",   label: "Plumbing",          desc: "Pipe runs, fixtures, válvulas y pressure-test output.",              href: "/tools/plumbing",   icon: "🔧" },
      { id: "hvac",       label: "HVAC",              desc: "Tonnage, duct runs, zonas, heat-pump risk y airflow.",               href: "/tools/hvac",       icon: "❄️" },
      { id: "solar",      label: "Solar / Renewable", desc: "Panel count, upgrade eléctrico, permiso e inspección.",              href: "/tools/solar",      icon: "☀️", highlight: true },
    ],
  },
  {
    id: "remodeling",
    label: "Remodelación Especializada",
    color: "#10b981",
    bg: "#f0fdf4",
    tools: [
      { id: "bathroom", label: "Bathroom Remodel", desc: "Tile, plomería, waterproofing, fixtures — cosmetic a full gut.",    href: "/tools/bathroom", icon: "🚿", highlight: true },
      { id: "kitchen",  label: "Kitchen Remodel",  desc: "Cabinets, countertops, plomería, riesgo y milestones.",            href: "/tools/kitchen",  icon: "🍳" },
      { id: "landscaping", label: "Landscaping",   desc: "Sod, mulch, irrigación, drenaje, grading y evidencia.",            href: "/tools/landscaping", icon: "🌿" },
    ],
  },
  {
    id: "ops",
    label: "Operaciones en Campo",
    color: "#ef4444",
    bg: "#fef2f2",
    tools: [
      { id: "project-manager", label: "Construction Manager", desc: "Crew, daily logs, change orders, inspecciones y cierre de obra.", href: "/tools/project-manager", icon: "📊", highlight: true },
      { id: "labor",      label: "Labor / Daily Ops",    desc: "Crew sign-in, task load, materiales, seguridad y cierre diario.", href: "/tools/labor",      icon: "👷" },
      { id: "demolition", label: "Demolition",           desc: "Demo selectivo, debris, utilities y flags de materiales peligrosos.", href: "/tools/demolition", icon: "🔩" },
      { id: "cleaning",   label: "Cleaning Service",     desc: "Crew sizing, horas, add-ons y milestones para limpieza post-construcción.", href: "/tools/cleaning",   icon: "🧹" },
    ],
  },
];

export default function ToolsHubPage() {
  const totalTools = CATEGORIES.reduce((acc, c) => acc + c.tools.length, 0);

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 20px 72px" }}>
      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 12px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 20, fontSize: 12, fontWeight: 700, color: "#2563eb", marginBottom: 16 }}>
          SEMSE ProTools · {totalTools} herramientas
        </div>
        <h1 style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)", fontWeight: 800, letterSpacing: "-0.02em", color: "var(--ink, #f1f5f9)", marginBottom: 10 }}>
          Herramientas de estimación y operaciones
        </h1>
        <p style={{ fontSize: 15, color: "var(--muted, #64748b)", maxWidth: 600, lineHeight: 1.6 }}>
          Estimación hardened en el backend, Ollama IA integrada y salida conectada al flujo de escrow, evidencia y milestones.
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
          <Link
            href="/tools/dashboard"
            style={{ padding: "9px 20px", borderRadius: 8, background: "#3b82f6", textDecoration: "none", color: "#fff", fontSize: 13, fontWeight: 700 }}
          >
            Ver Unified Dashboard →
          </Link>
          <Link
            href="/tools/electrical/dashboard"
            style={{ padding: "9px 20px", borderRadius: 8, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", textDecoration: "none", color: "#fbbf24", fontSize: 13, fontWeight: 600 }}
          >
            ⚡ Electrical Dashboard
          </Link>
        </div>
      </div>

      {/* Category sections */}
      <div style={{ display: "grid", gap: 36 }}>
        {CATEGORIES.map((cat) => (
          <section key={cat.id}>
            {/* Category header */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, paddingBottom: 10, borderBottom: `2px solid ${cat.color}30` }}>
              <span style={{ width: 12, height: 12, borderRadius: "50%", background: cat.color, flexShrink: 0 }} />
              <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink, #f1f5f9)", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                {cat.label}
              </h2>
              <span style={{ fontSize: 12, color: "var(--muted, #64748b)", marginLeft: 4 }}>
                {cat.tools.length} herramientas
              </span>
            </div>

            {/* Tools grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
              {cat.tools.map((tool) => (
                <Link
                  key={tool.id}
                  href={tool.href}
                  style={{
                    display: "block",
                    padding: "18px 18px 16px",
                    borderRadius: 12,
                    border: tool.highlight ? `1px solid ${cat.color}40` : "1px solid var(--border, rgba(255,255,255,0.08))",
                    background: tool.highlight ? `${cat.color}08` : "var(--bg-2, rgba(255,255,255,0.02))",
                    textDecoration: "none",
                    transition: "border-color 0.15s, background 0.15s",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 24, lineHeight: 1 }}>{tool.icon}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink, #f1f5f9)" }}>{tool.label}</div>
                      {tool.highlight && (
                        <span style={{ fontSize: 10, fontWeight: 800, color: cat.color, letterSpacing: "0.06em" }}>DESTACADO</span>
                      )}
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--muted, #64748b)", lineHeight: 1.6, margin: 0 }}>
                    {tool.desc}
                  </p>
                  <div style={{ marginTop: 12, fontSize: 12, fontWeight: 700, color: cat.color }}>
                    Abrir →
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Footer stats */}
      <div style={{ marginTop: 48, padding: "20px 24px", borderRadius: 12, border: "1px solid var(--border, rgba(255,255,255,0.08))", background: "var(--bg-2, rgba(255,255,255,0.02))", display: "flex", gap: 32, flexWrap: "wrap" }}>
        {CATEGORIES.map((cat) => (
          <div key={cat.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: cat.color }} />
            <span style={{ fontSize: 12, color: "var(--muted, #64748b)" }}>{cat.label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink, #f1f5f9)" }}>{cat.tools.length}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
