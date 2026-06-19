"use client";

import { useEffect, useState } from "react";
import { Calendar, CheckCircle, Clock, MapPin } from "lucide-react";
import { HtmlInCanvasPanel } from "@semse/ui";
import { fetchMyJobs } from "../../../semse-api";
import type { JobRecordView } from "@semse/schemas";
import { ClientPageHeader } from "../../../components/client/ClientPageHeader";

const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DAY_NAMES = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  in_progress: { label: "En progreso", color: "#6366f1", dot: "#6366f1" },
  accepted:    { label: "Aceptado",    color: "#10b981", dot: "#10b981" },
  reserved:    { label: "Reservado",   color: "#f59e0b", dot: "#f59e0b" },
  review:      { label: "En revisión", color: "#06b6d4", dot: "#06b6d4" },
  posted:      { label: "Publicado",   color: "#3b82f6", dot: "#3b82f6" },
  completed:   { label: "Completado",  color: "#64748b", dot: "#64748b" },
};

type AgendaJob = {
  id: string;
  title: string;
  status: string;
  location?: string;
  budgetMin?: number;
  budgetMax?: number;
  createdAt?: string;
};

function toAgendaJob(j: JobRecordView): AgendaJob {
  return {
    id: j.id,
    title: String(j.title ?? j.id),
    status: String(j.status ?? ""),
    location: (j as Record<string, unknown>).location ? String((j as Record<string, unknown>).location) : undefined,
    budgetMin: typeof j.budgetMin === "number" ? j.budgetMin : undefined,
    budgetMax: typeof j.budgetMax === "number" ? j.budgetMax : undefined,
    createdAt: (j as Record<string, unknown>).createdAt ? String((j as Record<string, unknown>).createdAt) : undefined,
  };
}

function JobItem({ job }: { job: AgendaJob }) {
  const cfg = STATUS_CONFIG[job.status] ?? { label: job.status, color: "var(--muted)", dot: "var(--muted)" };
  const budget = job.budgetMin || job.budgetMax
    ? `$${(job.budgetMin ?? job.budgetMax ?? 0).toLocaleString()}`
    : null;

  return (
    <div style={{
      padding: "12px 14px", borderRadius: 12, border: "1px solid var(--border)",
      background: "var(--surface)", display: "flex", gap: 12, alignItems: "flex-start",
    }}>
      <div style={{ width: 10, height: 10, borderRadius: "50%", background: cfg.dot, flexShrink: 0, marginTop: 4 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 3 }}>{job.title}</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: cfg.color, fontWeight: 700 }}>{cfg.label}</span>
          {job.location && (
            <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "var(--muted)" }}>
              <MapPin size={10} />{job.location}
            </span>
          )}
          {budget && <span style={{ fontSize: 11, color: "var(--muted)" }}>{budget}</span>}
        </div>
      </div>
    </div>
  );
}

function MiniCalendar({
  year,
  month,
  jobDates,
  onDayClick,
  selectedDay,
}: {
  year: number;
  month: number;
  jobDates: Set<string>;
  onDayClick: (day: number) => void;
  selectedDay: number | null;
}) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <div style={{ userSelect: "none" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 6 }}>
        {DAY_NAMES.map((d) => (
          <div key={d} style={{ fontSize: 10, color: "var(--muted)", textAlign: "center", fontWeight: 700 }}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />;
          const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const hasJob = jobDates.has(key);
          const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
          const isSelected = selectedDay === day;
          return (
            <button
              key={day}
              onClick={() => onDayClick(day)}
              style={{
                padding: "4px 2px", borderRadius: 6, border: "none",
                background: isSelected ? "#6366f1" : isToday ? "rgba(99,102,241,.15)" : "transparent",
                color: isSelected ? "#fff" : isToday ? "#818cf8" : "var(--ink)",
                fontSize: 11, fontWeight: hasJob || isToday ? 700 : 400,
                cursor: "pointer", position: "relative", textAlign: "center",
              }}
            >
              {day}
              {hasJob && !isSelected && (
                <div style={{
                  position: "absolute", bottom: 1, left: "50%", transform: "translateX(-50%)",
                  width: 4, height: 4, borderRadius: "50%", background: "#10b981",
                }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function WorkerAgendaPage() {
  const [jobs, setJobs] = useState<AgendaJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [filterStatus, setFilterStatus] = useState<string>("active");
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchMyJobs()
      .then((data) => setJobs(data.map(toAgendaJob)))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const ACTIVE_STATUSES = new Set(["in_progress", "accepted", "reserved", "review"]);

  const filtered = jobs.filter((j) => {
    if (filterStatus === "active") return ACTIVE_STATUSES.has(j.status);
    if (filterStatus === "all") return true;
    return j.status === filterStatus;
  });

  // Build set of days that have jobs for the calendar month
  const jobDates = new Set(
    jobs
      .filter((j) => ACTIVE_STATUSES.has(j.status))
      .map((j) => {
        // Use createdAt as a proxy for job date; real impl would use scheduled date
        if (j.createdAt) {
          const d = new Date(j.createdAt);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        }
        return null;
      })
      .filter(Boolean) as string[]
  );

  const selectedDayJobs = selectedDay
    ? jobs.filter((j) => {
        if (!j.createdAt) return false;
        const d = new Date(j.createdAt);
        return d.getFullYear() === calYear && d.getMonth() === calMonth && d.getDate() === selectedDay;
      })
    : [];

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", display: "grid", gap: "16px" }}>
      <ClientPageHeader
        title="Mi Agenda"
        subtitle="Trabajos activos y programados"
        breadcrumbs={[{ label: "Dashboard", href: "/worker/dashboard" }, { label: "Agenda" }]}
        minHeight={140}
        leading={
          <div style={{ width: 42, height: 42, borderRadius: 14, background: "rgba(99,102,241,.15)", display: "grid", placeItems: "center" }}>
            <Calendar size={20} color="#818cf8" />
          </div>
        }
        actions={
          <div style={{ display: "flex", gap: 6 }}>
            {(["list", "calendar"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  padding: "7px 12px", borderRadius: 8, border: "none",
                  background: view === v ? "rgba(99,102,241,.2)" : "transparent",
                  color: view === v ? "#818cf8" : "var(--muted)",
                  fontSize: 12, fontWeight: view === v ? 700 : 400, cursor: "pointer",
                }}
              >
                {v === "list" ? "Lista" : "Calendario"}
              </button>
            ))}
          </div>
        }
      />

      {/* Status filter */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[
          { id: "active", label: "Activos" },
          { id: "all", label: "Todos" },
          { id: "completed", label: "Completados" },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilterStatus(f.id)}
            style={{
              padding: "6px 12px", borderRadius: 999,
              border: filterStatus === f.id ? "1px solid rgba(99,102,241,.4)" : "1px solid var(--border)",
              background: filterStatus === f.id ? "rgba(99,102,241,.2)" : "var(--surface)",
              color: filterStatus === f.id ? "#818cf8" : "var(--muted)",
              fontWeight: filterStatus === f.id ? 700 : 400, fontSize: 12,
              cursor: "pointer",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {view === "calendar" ? (
        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16 }}>
          <HtmlInCanvasPanel style={{ border: "1px solid var(--border)", borderRadius: 16, background: "var(--surface)", padding: "16px" }} minHeight={200}>
            {/* Month navigation */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <button
                onClick={() => { if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); } else setCalMonth(m => m - 1); }}
                style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 16 }}
              >‹</button>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                {MONTH_NAMES[calMonth]} {calYear}
              </span>
              <button
                onClick={() => { if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); } else setCalMonth(m => m + 1); }}
                style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 16 }}
              >›</button>
            </div>
            <MiniCalendar
              year={calYear} month={calMonth} jobDates={jobDates}
              selectedDay={selectedDay}
              onDayClick={(d) => setSelectedDay(d === selectedDay ? null : d)}
            />
          </HtmlInCanvasPanel>

          <div style={{ display: "grid", gap: 10, alignContent: "start" }}>
            {selectedDay ? (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                  {selectedDay} de {MONTH_NAMES[calMonth]}
                </div>
                {selectedDayJobs.length === 0 ? (
                  <div style={{ color: "var(--muted)", fontSize: 13 }}>Sin trabajos este día.</div>
                ) : selectedDayJobs.map((job) => <JobItem key={job.id} job={job} />)}
              </>
            ) : (
              <div style={{ color: "var(--muted)", fontSize: 13, paddingTop: 8 }}>Selecciona un día para ver los trabajos.</div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {loading ? (
            <div style={{ padding: "24px", textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Cargando...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center", color: "var(--muted)", border: "1px dashed var(--border)", borderRadius: 14, fontSize: 13 }}>
              {filterStatus === "active" ? "No tienes trabajos activos en este momento." : "Sin trabajos."}
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Clock size={14} color="var(--muted)" />
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{filtered.length} trabajo{filtered.length !== 1 ? "s" : ""}</span>
              </div>
              {filtered.map((job) => <JobItem key={job.id} job={job} />)}
            </>
          )}
        </div>
      )}
    </div>
  );
}
