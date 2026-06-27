"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight as CR } from "lucide-react";

interface Task {
  id: string; title: string; type: string; status: string;
  priority: string; dueAt?: string;
}

const PRIORITY_DOT: Record<string, string> = {
  LOW:    "#94a3b8",
  MEDIUM: "#93c5fd",
  HIGH:   "#fcd34d",
  URGENT: "#fca5a5",
};
const STATUS_DOT: Record<string, string> = {
  PENDING:     "#94a3b8",
  IN_PROGRESS: "#93c5fd",
  COMPLETED:   "#6ee7b7",
  BLOCKED:     "#fca5a5",
  CANCELLED:   "#475569",
};

function farmTabs(farmId: string) {
  return [
    { href: `/agro/${farmId}`,               label: "Dashboard"       },
    { href: `/agro/${farmId}/animals`,        label: "Animales"        },
    { href: `/agro/${farmId}/tasks`,          label: "Tareas"          },
    { href: `/agro/${farmId}/calendar`,       label: "Calendario"      },
    { href: `/agro/${farmId}/feeding`,         label: "Alimentación"    },
    { href: `/agro/${farmId}/inventory`,      label: "Inventario"      },
    { href: `/agro/${farmId}/costs`,          label: "Costos"          },
    { href: `/agro/${farmId}/reproduction`,   label: "Reproducción"    },
    { href: `/agro/${farmId}/infrastructure`, label: "Infraestructura" },
    { href: `/agro/${farmId}/evidence`,       label: "Evidencia"       },
    { href: `/agro/${farmId}/audit`,          label: "Auditoría"       },
  ];
}

const MONTH_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DOW_ES   = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

export default function CalendarPage() {
  const { farmId } = useParams<{ farmId: string }>();
  const pathname   = usePathname();
  const today      = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => { if (farmId) void load(); }, [farmId]);

  async function load() {
    setLoading(true);
    try {
      const res  = await fetch(`/api/semse/agro/farms/${farmId}/tasks`);
      const json = await res.json();
      setTasks((json.data as any)?.tasks ?? []);
    } catch { /* best-effort */ }
    finally { setLoading(false); }
  }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelected(null);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelected(null);
  }

  const firstDow  = new Date(year, month, 1).getDay();
  const daysCount = new Date(year, month + 1, 0).getDate();

  function tasksOnDay(day: number) {
    return tasks.filter(t => {
      if (!t.dueAt) return false;
      const d = new Date(t.dueAt);
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
    });
  }

  const selectedTasks = selected != null ? tasksOnDay(selected) : [];
  const tabs = farmId ? farmTabs(farmId) : [];

  return (
    <div className="agro-shell">
      <nav className="bread">
        <Link href="/agro">Agro</Link>
        <CR size={12} color="var(--faint)" />
        <Link href={`/agro/${farmId}`}>Finca</Link>
        <CR size={12} color="var(--faint)" />
        <span style={{ color: "var(--ink)" }}>Calendario</span>
      </nav>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", letterSpacing: "-0.03em" }}>Calendario de tareas</h1>
      </div>

      <nav className="tab-bar">
        {tabs.map(tab => (
          <Link key={tab.href} href={tab.href} className="tab-item"
            data-active={pathname === tab.href ? "true" : "false"}>{tab.label}</Link>
        ))}
      </nav>

      <div style={{ display: "grid", gap: 20, gridTemplateColumns: "1fr 300px" }}>
        {/* Calendar grid */}
        <div style={{ borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)", padding: "20px" }}>
          {/* Month nav */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <button onClick={prevMonth} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: "4px 8px", borderRadius: 6 }}>
              <ChevronLeft size={18} />
            </button>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
              {MONTH_ES[month]} {year}
            </span>
            <button onClick={nextMonth} style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: "4px 8px", borderRadius: 6 }}>
              <CR size={18} />
            </button>
          </div>

          {/* DOW headers */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 6 }}>
            {DOW_ES.map(d => (
              <div key={d} style={{ fontSize: 11, fontWeight: 700, color: "var(--faint)", textAlign: "center", padding: "4px 0", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {d}
              </div>
            ))}
          </div>

          {/* Days */}
          {loading ? (
            <div className="skel" style={{ height: 240 }} />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
              {Array.from({ length: firstDow }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {Array.from({ length: daysCount }, (_, i) => i + 1).map(day => {
                const dayTasks = tasksOnDay(day);
                const isToday  = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                const isSel    = selected === day;
                return (
                  <button
                    key={day}
                    onClick={() => setSelected(day === selected ? null : day)}
                    style={{
                      border: "none",
                      borderRadius: 8,
                      padding: "6px 4px",
                      background: isSel ? "var(--brand)" : isToday ? "rgba(59,130,246,.12)" : "transparent",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 3,
                      fontFamily: "inherit",
                      transition: "background 120ms",
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: isToday || isSel ? 700 : 400, color: isSel ? "#fff" : isToday ? "#93c5fd" : "var(--ink)" }}>
                      {day}
                    </span>
                    {dayTasks.length > 0 && (
                      <div style={{ display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "center" }}>
                        {dayTasks.slice(0, 3).map(t => (
                          <span key={t.id} style={{
                            width: 6, height: 6, borderRadius: "50%",
                            background: isSel ? "#fff" : (PRIORITY_DOT[t.priority] ?? "#94a3b8"),
                          }} />
                        ))}
                        {dayTasks.length > 3 && (
                          <span style={{ fontSize: 9, color: isSel ? "#fff" : "var(--muted)" }}>+{dayTasks.length - 3}</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div style={{ display: "flex", gap: 14, marginTop: 16, flexWrap: "wrap" }}>
            {Object.entries(PRIORITY_DOT).map(([p, c]) => (
              <div key={p} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: c, display: "block" }} />
                <span style={{ fontSize: 11, color: "var(--muted)" }}>{p}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Side panel */}
        <div style={{ borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface)", padding: "20px" }}>
          {selected ? (
            <>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 12 }}>
                {selected} de {MONTH_ES[month]}
                <span style={{ fontSize: 12, fontWeight: 400, color: "var(--muted)", marginLeft: 6 }}>
                  ({selectedTasks.length} tareas)
                </span>
              </h3>
              {selectedTasks.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--muted)" }}>Sin tareas este día.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {selectedTasks.map(t => (
                    <div key={t.id} style={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--base)", padding: "10px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: STATUS_DOT[t.status] ?? "#94a3b8", display: "block", flexShrink: 0 }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", lineHeight: 1.3 }}>{t.title}</span>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <span className={`badge ${t.priority === "URGENT" ? "badge-red" : t.priority === "HIGH" ? "badge-amber" : t.priority === "MEDIUM" ? "badge-blue" : "badge-slate"}`}>
                          {t.priority}
                        </span>
                        <span className={`badge ${t.status === "COMPLETED" ? "badge-green" : t.status === "BLOCKED" ? "badge-red" : t.status === "IN_PROGRESS" ? "badge-blue" : "badge-slate"}`}>
                          {t.status.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>Resumen del mes</h3>
              {(() => {
                const monthTasks = tasks.filter(t => {
                  if (!t.dueAt) return false;
                  const d = new Date(t.dueAt);
                  return d.getFullYear() === year && d.getMonth() === month;
                });
                const byStatus = monthTasks.reduce<Record<string, number>>((acc, t) => {
                  acc[t.status] = (acc[t.status] ?? 0) + 1; return acc;
                }, {});
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                    {Object.entries(byStatus).map(([status, cnt]) => (
                      <div key={status} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span style={{ color: "var(--muted)" }}>{status.replace("_", " ")}</span>
                        <span style={{ fontWeight: 700, color: "var(--ink)" }}>{cnt}</span>
                      </div>
                    ))}
                    {monthTasks.length === 0 && <p style={{ fontSize: 12, color: "var(--muted)" }}>Sin tareas este mes.</p>}
                  </div>
                );
              })()}
              <p style={{ fontSize: 11, color: "var(--faint)" }}>Haz clic en un día para ver sus tareas.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
