"use client";

/**
 * Admin — Usuarios
 * Gestión de clientes y profesionales: verificación, estado, KPIs
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "../../../../lib/language-context";
import Link from "next/link";
import { Search, ShieldCheck, Star, Building2, MoreHorizontal, RefreshCw, Inbox, Scale } from "lucide-react";
import { NotificationBanner } from "../../../components/notifications/NotificationBanner";
import { StatusBadge } from "@semse/ui";
import {
  fetchDisputes,
  fetchRatings,
  fetchUserMemberships,
  fetchUsers,
  updateUserStatus,
  verifyUser,
  type UserMembershipView,
  type UserView
} from "../../../semse-api";

type UserStatus = "active" | "pending" | "suspended";
type UserRole = "client" | "worker" | "admin";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  verified: boolean;
  joined: string;
  orgCount: number;
  trustScore: number;
  riskLevel: string;
  rating: number | null;
}

const STATUS_CONFIG: Record<UserStatus, { variant: "success" | "warning" | "error"; label: string }> = {
  active:    { variant: "success", label: "Activo"     },
  pending:   { variant: "warning", label: "Pendiente"  },
  suspended: { variant: "error",   label: "Suspendido" },
};

const ROLE_CONFIG: Record<UserRole, { label: string; color: string }> = {
  client: { label: "Cliente",      color: "var(--brand)" },
  worker: { label: "Profesional",  color: "#10b981"      },
  admin:  { label: "Operaciones",  color: "#f59e0b"      },
};

function deriveDisplayName(user: UserView, memberships: UserMembershipView[]): string {
  const primaryOrgName = memberships[0]?.org?.name?.trim();
  if (primaryOrgName) {
    return primaryOrgName;
  }

  const localPart = user.email.split("@")[0] ?? user.email;
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function deriveUserRole(memberships: UserMembershipView[]): UserRole {
  const roleKeys = memberships.map((membership) => membership.role.key);
  if (roleKeys.includes("OPS_ADMIN")) return "admin";
  if (roleKeys.includes("PRO") || roleKeys.includes("WORKER")) return "worker";
  return "client";
}

function normalizeUserStatus(status: string): UserStatus {
  return status === "pending" || status === "suspended" ? status : "active";
}

export default function AdminUsersPage() {
  const { t } = useLanguage();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | UserStatus>("all");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [actingUserId, setActingUserId] = useState<string | null>(null);
  const [disputesByUserId, setDisputesByUserId] = useState<Record<string, number>>({});
  const menuRef = useRef<HTMLDivElement | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const [rawUsers, disputes, ratingsResult] = await Promise.all([
        fetchUsers(),
        fetchDisputes().catch(() => []),
        fetchRatings().catch(() => ({ actorUserId: null, items: [] })),
      ]);

      const membershipEntries = await Promise.all(
        rawUsers.map(async (user) => [user.id, await fetchUserMemberships(user.id).catch(() => [])] as const),
      );
      const membershipsByUserId = Object.fromEntries(membershipEntries);

      const rows: UserRow[] = rawUsers.map((user) => {
        const memberships = membershipsByUserId[user.id] ?? [];
        return {
          id: user.id,
          name: deriveDisplayName(user, memberships),
          email: user.email,
          role: deriveUserRole(memberships),
          status: normalizeUserStatus(user.status),
          verified: user.verificationStatus === "verified",
          joined: user.createdAt,
          orgCount: memberships.length,
          trustScore: user.trustScore,
          riskLevel: user.riskLevel,
          rating: null,
        };
      });

      const dCounts: Record<string, number> = {};
      for (const dispute of disputes) {
        const row = dispute as Record<string, unknown>;
        const status = String(row.status ?? "").toUpperCase();
        if (status !== "OPEN" && status !== "ASSIGNED" && status !== "UNDER_REVIEW") {
          continue;
        }
        for (const key of ["raisedById", "assigneeUserId", "resolvedByUserId"]) {
          const userId = row[key];
          if (typeof userId === "string" && userId.length > 0) {
            dCounts[userId] = (dCounts[userId] ?? 0) + 1;
          }
        }
      }

      const ratingMap: Record<string, number[]> = {};
      for (const r of ratingsResult.items) {
        const uid = r.toUser?.id;
        if (uid) { ratingMap[uid] = ratingMap[uid] ?? []; ratingMap[uid].push(r.score); }
      }

      setUsers(rows.map((user) => {
        const scores = ratingMap[user.id];
        const rating = scores && scores.length > 0
          ? Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10
          : null;
        return {
          ...user,
          rating,
        };
      }));
      setDisputesByUserId(dCounts);
    } catch {
      setUsers([]);
      setDisputesByUserId({});
    }
    setLoading(false);
  }, []);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function applyAction(userId: string, action: "verify" | "suspend" | "activate") {
    setActingUserId(userId);
    try {
      if (action === "verify") {
        const updated = await verifyUser(userId);
        setUsers((prev) => prev.map((user) => (
          user.id === userId
            ? { ...user, verified: updated.verificationStatus === "verified" }
            : user
        )));
      } else {
        const updated = await updateUserStatus(userId, action === "suspend" ? "suspended" : "active");
        setUsers((prev) => prev.map((user) => (
          user.id === userId
            ? { ...user, status: normalizeUserStatus(updated.status) }
            : user
        )));
      }
    } finally {
      setOpenMenuId(null);
      setActingUserId(null);
    }
  }

  const filtered = users.filter(u => {
    const matchRole   = roleFilter === "all"   || u.role === roleFilter;
    const matchStatus = statusFilter === "all" || u.status === statusFilter;
    const matchQ = !query || u.name.toLowerCase().includes(query.toLowerCase()) || u.email.toLowerCase().includes(query.toLowerCase());
    return matchRole && matchStatus && matchQ;
  });

  const pendingVerification = users.filter(u => !u.verified && u.status === "pending").length;

  const card: React.CSSProperties = {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px",
  };

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
      <div style={{ marginBottom: "24px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <Link href="/admin/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "var(--muted)", fontSize: "12px", fontWeight: 600, textDecoration: "none", marginBottom: "8px" }}>
            <span style={{ fontSize: "14px" }}>←</span> Dashboard
          </Link>
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: "var(--ink)", marginBottom: "4px" }}>{t("page.users")}</h1>
          <p style={{ fontSize: "13px", color: "var(--muted)" }}>Gestión de clientes y profesionales del marketplace</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: "24px" }}>
          <NotificationBanner audience="admin" />
          <button
            onClick={() => void loadUsers()}
            disabled={loading}
            style={{ padding: "8px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--muted)", cursor: "pointer", display: "flex" }}
            title="Recargar"
          >
            <RefreshCw size={15} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px", marginBottom: "20px" }}>
        {[
          { label: "Total usuarios",         value: users.length,                                                           color: "var(--brand)" },
          { label: "Clientes activos",        value: users.filter(u => u.role === "client" && u.status === "active").length, color: "#3b82f6" },
          { label: "Profesionales activos",   value: users.filter(u => u.role === "worker" && u.status === "active").length, color: "#10b981" },
          { label: "Pendientes verificación", value: pendingVerification, color: pendingVerification > 0 ? "#f59e0b" : "#10b981" },
        ].map(kpi => (
          <div key={kpi.label} style={{ ...card, padding: "12px 14px" }}>
            <p style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 600 }}>{kpi.label.toUpperCase()}</p>
            <p style={{ fontSize: "22px", fontWeight: 800, color: kpi.color, marginTop: "4px" }}>{loading ? "—" : kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "14px", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: "4px", background: "var(--surface)", padding: "4px", borderRadius: "10px", border: "1px solid var(--border)" }}>
          {(["all", "client", "worker", "admin"] as const).map(r => (
            <button key={r} onClick={() => setRoleFilter(r)} style={{
              padding: "5px 12px", borderRadius: "7px", border: "none",
              background: roleFilter === r ? "#8b5cf6" : "transparent",
              color: roleFilter === r ? "#fff" : "var(--muted)",
              fontSize: "12px", fontWeight: 600, cursor: "pointer",
            }}>
              {r === "all" ? "Todos" : r === "client" ? "Clientes" : r === "worker" ? "Profesionales" : "Ops"}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: "4px", background: "var(--surface)", padding: "4px", borderRadius: "10px", border: "1px solid var(--border)" }}>
          {(["all", "active", "pending", "suspended"] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              padding: "5px 12px", borderRadius: "7px", border: "none",
              background: statusFilter === s ? "#6b7280" : "transparent",
              color: statusFilter === s ? "#fff" : "var(--muted)",
              fontSize: "12px", fontWeight: 600, cursor: "pointer",
            }}>
              {s === "all" ? "Todos" : s === "active" ? "Activos" : s === "pending" ? "Pendientes" : "Suspendidos"}
            </button>
          ))}
        </div>
        <div style={{ position: "relative", flex: 1, minWidth: "200px", maxWidth: "280px" }}>
          <Search size={13} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar usuario..."
            style={{
              width: "100%", paddingLeft: "30px", paddingRight: "12px", height: "32px",
              borderRadius: "8px", border: "1px solid var(--border)",
              background: "var(--surface)", color: "var(--ink)", fontSize: "13px", outline: "none", boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      {/* User Table */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[1,2,3,4].map(i => <div key={i} style={{ height: "56px", borderRadius: "10px", background: "var(--raised)", animation: "pulse 1.5s ease-in-out infinite" }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ ...card, padding: "48px 24px", textAlign: "center" }}>
          <Inbox size={32} style={{ color: "var(--faint)", margin: "0 auto 12px" }} />
          <p style={{ fontSize: "14px", fontWeight: 600, color: "var(--muted)" }}>Sin usuarios</p>
          <p style={{ fontSize: "12px", color: "var(--faint)", marginTop: "4px" }}>Ajusta los filtros o espera a que lleguen registros.</p>
        </div>
      ) : (
        <div style={{ ...card, overflow: "hidden" }} ref={menuRef}>
          {/* Header */}
          <div style={{ display: "grid", gridTemplateColumns: "220px 100px 110px 80px 100px 70px 80px 80px", gap: "0", padding: "10px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg)" }}>
            {["Usuario", "Rol", "Estado", "Orgs", "Trust", "Rating", "Disputas", ""].map(h => (
              <p key={h} style={{ fontSize: "11px", fontWeight: 700, color: "var(--faint)", textTransform: "uppercase" }}>{h}</p>
            ))}
          </div>
          {/* Rows */}
          {filtered.map((u, i) => {
            const s = STATUS_CONFIG[u.status];
            const r = ROLE_CONFIG[u.role];
            return (
              <div
                key={u.id}
                style={{
                  display: "grid", gridTemplateColumns: "220px 100px 110px 80px 100px 70px 80px 80px",
                  gap: "0", padding: "12px 16px", alignItems: "center",
                  borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none",
                  position: "relative",
                }}
                onMouseOver={e => (e.currentTarget.style.background = "var(--bg)")}
                onMouseOut={e => (e.currentTarget.style.background = "transparent")}
              >
                {/* User */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                  <div style={{
                    width: "32px", height: "32px", borderRadius: "50%", flexShrink: 0,
                    background: r.color + "20",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "13px", fontWeight: 800, color: r.color,
                  }}>
                    {u.name.charAt(0)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</p>
                      {u.verified && <ShieldCheck size={12} color="#10b981" />}
                    </div>
                    <p style={{ fontSize: "11px", color: "var(--faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</p>
                    <p style={{ fontSize: "10px", color: "var(--faint)" }}>Desde {new Date(u.joined).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}</p>
                  </div>
                </div>
                {/* Role */}
                <span style={{ fontSize: "11px", fontWeight: 700, color: r.color, padding: "2px 8px", background: r.color + "18", borderRadius: "5px", width: "fit-content" }}>
                  {r.label}
                </span>
                {/* Status */}
                <StatusBadge variant={s.variant} text={s.label} size="sm" dot />
                {/* Organizations */}
                <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <Building2 size={12} color="var(--faint)" />
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>{u.orgCount}</span>
                </div>
                {/* Trust */}
                <div>
                  <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>{Math.round(u.trustScore * 100)}%</p>
                  <p style={{ fontSize: "10px", color: "var(--faint)", textTransform: "uppercase" }}>{u.riskLevel}</p>
                </div>
                {/* Rating */}
                <div>
                  {u.rating ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <Star size={12} color="#f59e0b" fill="#f59e0b" />
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--ink)" }}>{u.rating}</span>
                    </div>
                  ) : <span style={{ fontSize: "12px", color: "var(--faint)" }}>—</span>}
                </div>
                {/* Disputes */}
                <div>
                  {(disputesByUserId[u.id] ?? 0) > 0 ? (
                    <Link href="/admin/disputes" style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: 800, color: "#ef4444", textDecoration: "none", padding: "2px 6px", borderRadius: "6px", background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)" }}>
                      <Scale size={10} /> {disputesByUserId[u.id]}
                    </Link>
                  ) : <span style={{ fontSize: "12px", color: "var(--faint)" }}>—</span>}
                </div>
                {/* Actions */}
                <div style={{ position: "relative" }}>
                  <button
                    disabled={actingUserId === u.id}
                    onClick={() => setOpenMenuId(openMenuId === u.id ? null : u.id)}
                    style={{ padding: "4px 6px", borderRadius: "6px", border: "1px solid var(--border)", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    <MoreHorizontal size={14} color="var(--muted)" />
                  </button>
                  {openMenuId === u.id && (
                    <div style={{
                      position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 100,
                      background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px",
                      boxShadow: "0 8px 24px rgba(0,0,0,.15)", minWidth: "140px", overflow: "hidden",
                    }}>
                      <Link href={`/admin/users/${u.id}`} style={{ display: "block", width: "100%", padding: "9px 14px", color: "#818cf8", fontSize: "12px", fontWeight: 600, textDecoration: "none" }}>
                        ◈ Ver perfil
                      </Link>
                      {!u.verified && (
                        <button onClick={() => { if (window.confirm(`¿Marcar a ${u.name || u.email} como verificado? Esta pantalla no muestra ningún documento/evidencia de respaldo — confirma que ya la revisaste por otro medio.`)) void applyAction(u.id, "verify"); }} style={{ display: "block", width: "100%", padding: "9px 14px", border: "none", background: "transparent", color: "#10b981", fontSize: "12px", fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
                          ✓ Verificar
                        </button>
                      )}
                      {u.status !== "suspended" && (
                        <button onClick={() => { if (window.confirm(`¿Suspender la cuenta de ${u.name || u.email}? Esto bloquea su acceso de inmediato.`)) void applyAction(u.id, "suspend"); }} style={{ display: "block", width: "100%", padding: "9px 14px", border: "none", background: "transparent", color: "#ef4444", fontSize: "12px", fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
                          ⊘ Suspender
                        </button>
                      )}
                      {u.status === "suspended" && (
                        <button onClick={() => { if (window.confirm(`¿Reactivar la cuenta de ${u.name || u.email}?`)) void applyAction(u.id, "activate"); }} style={{ display: "block", width: "100%", padding: "9px 14px", border: "none", background: "transparent", color: "#10b981", fontSize: "12px", fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
                          ↑ Activar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
