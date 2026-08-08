import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { mobileLogin } from "@/lib/auth/mobile-auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) { setError("Email y contraseña requeridos"); return; }
    setLoading(true);
    setError(null);
    try {
      const result = await mobileLogin(email.trim().toLowerCase(), password);
      const isWorker = result.identity.roles.some(r => ["PRO", "WORKER"].includes(r));
      const isClient = result.identity.roles.some(r => r === "CLIENT");
      navigate(isClient ? "/cliente" : isWorker ? "/" : "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)", padding: "24px",
    }}>
      <div style={{
        width: "100%", maxWidth: 400, background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "36px 32px",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16, margin: "0 auto 16px",
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 32, fontWeight: 900, color: "#fff",
          }}>S</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#fff", margin: 0 }}>SEMSE</h1>
          <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>Plataforma operativa</p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} style={{ display: "grid", gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", display: "block", marginBottom: 6 }}>
              CORREO ELECTRÓNICO
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              autoComplete="email"
              style={{
                width: "100%", padding: "11px 14px", borderRadius: 10, boxSizing: "border-box",
                border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)",
                color: "#f1f5f9", fontSize: 14, outline: "none",
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: "#94a3b8", display: "block", marginBottom: 6 }}>
              CONTRASEÑA
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              style={{
                width: "100%", padding: "11px 14px", borderRadius: 10, boxSizing: "border-box",
                border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)",
                color: "#f1f5f9", fontSize: 14, outline: "none",
              }}
            />
          </div>

          {error && (
            <div style={{
              padding: "10px 14px", borderRadius: 8,
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
              fontSize: 13, color: "#fca5a5",
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "13px", borderRadius: 10, border: "none",
              background: loading ? "#475569" : "linear-gradient(135deg, #3b82f6, #8b5cf6)",
              color: "#fff", fontSize: 15, fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer", marginTop: 4,
            }}
          >
            {loading ? "Iniciando sesión..." : "Entrar"}
          </button>
        </form>

        <div style={{ marginTop: 24, padding: "16px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p style={{ fontSize: 11, color: "#475569", margin: "0 0 8px", fontWeight: 700 }}>CUENTAS DEMO</p>
          {[
            ["client@demo.semse", "Cliente"],
            ["worker@demo.semse", "Profesional"],
            ["admin@demo.semse", "Admin"],
          ].map(([mail, role]) => (
            <button
              key={mail}
              type="button"
              onClick={() => { setEmail(mail); setPassword("demo1234"); }}
              style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "6px 0", background: "none", border: "none", cursor: "pointer",
                fontSize: 12, color: "#64748b",
              }}
            >
              <span style={{ color: "#3b82f6", fontWeight: 600 }}>{role}</span> — {mail}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
