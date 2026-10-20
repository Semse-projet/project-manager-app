"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity, Briefcase, Clock, DollarSign, MapPin, RefreshCw,
  Search, Star, Users, Zap,
} from "lucide-react";
import { AdminPageHeader } from "../../../components/admin/AdminPageHeader";
import { useLanguage, type LanguagePreference } from "../../../../lib/language-context";

// ── Types ─────────────────────────────────────────────────────────────────────

type Listing = {
  id: string; title: string; category: string | null; location: string | null;
  budgetMin: number | null; budgetMax: number | null; budgetType: string | null;
  status: string; urgency: string | null; scope: string; postedAt: string;
  clientOrg?: string; bidsCount: number;
};

type MarketplaceStats = {
  totalListings: number;
  byCategory:    Record<string, number>;
  byUrgency:     Record<string, number>;
  avgBudgetMin:  number | null;
};

type Professional = {
  id: string; name: string; email: string;
  completedJobs: number; avgRating: number | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const URGENCY_COLORS: Record<string, string> = {
  urgent: "#fca5a5", high: "#fb923c", medium: "#fcd34d", low: "#86efac",
};

const CATEGORY_IDS = ["painting", "plumbing", "drywall", "electrical", "hvac", "roofing", "carpentry", "cleaning", "general"] as const;

function UrgencyBadge({ urgency }: { urgency: string | null }) {
  const { t } = useLanguage();
  const color = URGENCY_COLORS[urgency ?? "medium"] ?? "#94a3b8";
  return (
    <span style={{ fontSize: 9, fontWeight: 800, color, background: `${color}20`, padding: "2px 7px", borderRadius: 99 }}>
      {t(`mp.urgency.${Object.hasOwn(URGENCY_COLORS, urgency ?? "") ? urgency : "medium"}`)}
    </span>
  );
}

function formatBudget(min: number | null, max: number | null, type: string | null, language: LanguagePreference, t: (key: string) => string): string {
  const money = (amount: number) => new Intl.NumberFormat(language === "en" ? "en-US" : "es-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  if (!min && !max) return t("mp.budgetOpen");
  if (min && max) return `${money(min)}–${money(max)} ${type ?? ""}`.trim();
  if (min) return `${t("mp.from")} ${money(min)}`;
  return `${t("mp.upTo")} ${money(max!)}`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MarketplacePage() {
  const { t, language } = useLanguage();
  const [listings, setListings] = useState<Listing[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [stats,    setStats]    = useState<MarketplaceStats | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [search,   setSearch]   = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [urgFilter, setUrgFilter] = useState("");
  const [tab,      setTab]      = useState<"listings" | "professionals">("listings");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const qs = new URLSearchParams();
      if (catFilter) qs.set("category", catFilter);
      if (urgFilter) qs.set("urgency",  urgFilter);

      const [lRes, pRes, sRes] = await Promise.all([
        fetch(`/api/semse/marketplace/listings?${qs}&limit=30`).then((r) => r.json()) as Promise<{ data: { listings: Listing[]; total: number } }>,
        fetch("/api/semse/marketplace/professionals?limit=10").then((r) => r.json()) as Promise<{ data: Professional[] }>,
        fetch("/api/semse/marketplace/stats").then((r) => r.json()) as Promise<{ data: MarketplaceStats }>,
      ]);

      let items = lRes.data?.listings ?? [];
      if (search) items = items.filter((l) => l.title.toLowerCase().includes(search.toLowerCase()) || l.location?.toLowerCase().includes(search.toLowerCase()));

      setListings(items);
      setProfessionals(pRes.data ?? []);
      setStats(sRes.data ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [catFilter, urgFilter, search]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px", color: "var(--ink)" }}>
      <AdminPageHeader
        title="Marketplace"
        subtitle={t("mp.subtitle")}
        icon={Briefcase}
        iconColor="#818cf8"
        iconBg="rgba(99,102,241,.15)"
        showBack={false}
        actions={
          <button onClick={load} disabled={loading} aria-label={t("mp.refresh")}
            style={{ padding: "8px 14px", borderRadius: 10, background: "rgba(255,255,255,.05)", border: "1px solid var(--border)", cursor: "pointer", fontSize: 12, color: "var(--muted)" }}>
            <RefreshCw size={12} className={loading ? "animate-spin" : undefined} />
          </button>
        }
      />

      {/* Stats */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: t("mp.posted"), value: String(stats.totalListings), icon: Briefcase, color: "#818cf8" },
            { label: t("mp.urgentJobs"),   value: String(stats.byUrgency["urgent"] ?? 0), icon: Zap, color: "#fca5a5" },
            { label: t("mp.avgBudget"), value: stats.avgBudgetMin ? new Intl.NumberFormat(language === "en" ? "en-US" : "es-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(stats.avgBudgetMin) : "—", icon: DollarSign, color: "#86efac" },
            { label: t("mp.professionals"), value: String(professionals.length), icon: Users, color: "#67e8f9" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} style={{ padding: "14px 16px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <Icon size={13} color={color} />
                <span style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700 }}>{label}</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "rgba(255,255,255,.03)", padding: 4, borderRadius: 12, border: "1px solid var(--border)", width: "fit-content" }}>
        {(["listings", "professionals"] as const).map((tabKey) => (
          <button key={tabKey} onClick={() => setTab(tabKey)}
            style={{ padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700,
              background: tab === tabKey ? "rgba(99,102,241,.2)" : "transparent",
              color: tab === tabKey ? "#818cf8" : "var(--muted)" }}>
            {t(tabKey === "listings" ? "mp.jobs" : "mp.professionals")}
          </button>
        ))}
      </div>

      {/* Filters */}
      {tab === "listings" && (
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <Search size={12} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("mp.searchJobs")}
              style={{ width: "100%", padding: "8px 10px 8px 28px", borderRadius: 10, border: "1px solid var(--border)", background: "rgba(255,255,255,.05)", color: "var(--ink)", fontSize: 12, boxSizing: "border-box" }} />
          </div>
          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: 12 }}>
            <option value="">{t("mp.allCategories")}</option>
            {CATEGORY_IDS.map((k) => <option key={k} value={k}>{t(`mp.category.${k}`)}</option>)}
          </select>
          <select value={urgFilter} onChange={(e) => setUrgFilter(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontSize: 12 }}>
            <option value="">{t("mp.allUrgencies")}</option>
            {["urgent", "high", "medium", "low"].map((u) => <option key={u} value={u}>{t(`mp.urgency.${u}`)}</option>)}
          </select>
        </div>
      )}

      {error && <div style={{ padding: "10px 14px", background: "rgba(239,68,68,.1)", borderRadius: 10, fontSize: 12, color: "#fca5a5", marginBottom: 14 }}>{error}</div>}

      {/* Listings */}
      {tab === "listings" && (
        <div style={{ display: "grid", gap: 12 }}>
          {listings.length === 0 && !loading && (
            <div style={{ padding: "32px", textAlign: "center", fontSize: 13, color: "var(--muted)", background: "var(--surface)", borderRadius: 14, border: "1px solid var(--border)" }}>
              {t("mp.noJobsAdmin")}
            </div>
          )}
          {listings.map((l) => (
            <div key={l.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: "var(--ink)" }}>{l.title}</span>
                    <UrgencyBadge urgency={l.urgency} />
                    {l.category && (
                      <span style={{ fontSize: 10, color: "#818cf8", background: "rgba(99,102,241,.1)", padding: "2px 8px", borderRadius: 99 }}>
                        {CATEGORY_IDS.some((key) => key === l.category) ? t(`mp.category.${l.category}`) : l.category}
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: 11, color: "var(--muted)", lineHeight: 1.4 }}>{l.scope}</p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#86efac" }}>{formatBudget(l.budgetMin, l.budgetMax, l.budgetType, language, t)}</div>
                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>{l.bidsCount} {t(l.bidsCount === 1 ? "mp.bidsSingular" : "mp.bidsPlural")}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 16, fontSize: 10, color: "var(--muted)" }}>
                {l.location && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><MapPin size={10} />{l.location}</span>}
                {l.clientOrg && <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Briefcase size={10} />{l.clientOrg}</span>}
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={10} />{new Date(l.postedAt).toLocaleDateString(language === "en" ? "en-US" : "es-MX")}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Professionals */}
      {tab === "professionals" && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 10, padding: "10px 18px", borderBottom: "1px solid var(--border)", fontSize: 10, fontWeight: 800, color: "var(--muted)" }}>
            <span>{t("mp.professional")}</span><span>{t("mp.workCount")}</span><span>{t("mp.rating")}</span><span>{t("mp.status")}</span>
          </div>
          {professionals.length === 0 && (
            <div style={{ padding: "24px", textAlign: "center", fontSize: 13, color: "var(--muted)" }}>{t("mp.noProfessionals")}</div>
          )}
          {professionals.map((p) => (
            <div key={p.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 10, padding: "12px 18px", borderBottom: "1px solid var(--border)", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</div>
                <div style={{ fontSize: 10, color: "var(--muted)" }}>{p.email}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#818cf8" }}>
                <Activity size={11} style={{ verticalAlign: "middle", marginRight: 4 }} />
                {p.completedJobs}
              </div>
              <div style={{ fontSize: 12, color: "#fcd34d", display: "flex", alignItems: "center", gap: 4 }}>
                <Star size={11} fill="#fcd34d" />
                {p.avgRating ?? "—"}
              </div>
              <div style={{ fontSize: 10, color: "#86efac", fontWeight: 600 }}>{t("mp.verified")}</div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
