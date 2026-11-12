"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, KeyRound, Orbit, Plus, RefreshCw, Trash2, Webhook } from "lucide-react";
import { AdminPageHeader } from "../../../components/admin/AdminPageHeader";
import {
  SATELLITE_SCOPES,
  fetchSatelliteTokens,
  fetchSatelliteWebhooks,
  issueSatelliteToken,
  revokeSatelliteToken,
  revokeSatelliteWebhook,
  type IssuedSatelliteToken,
  type SatelliteScope,
  type SatelliteToken,
  type SatelliteWebhook
} from "../../../lib/module-surfaces-api";
import {
  Banner,
  Button,
  ConfirmDialog,
  Empty,
  Field,
  Loading,
  Panel,
  Pill,
  Stat,
  StatGrid,
  formatDate,
  inputStyle,
  type Tone
} from "../../../../components/module-surface/ui";

// Specs: docs/specs/satellites/SAT-001-semse-sdk.spec.md (APPROVED) and
// SAT-007-outbound-webhooks.spec.md (IMPLEMENTED). Requires satellites:admin.

const SCOPE_HELP: Record<SatelliteScope, string> = {
  "intake:read": "Leer solicitudes de intake",
  "intake:write": "Crear solicitudes de intake",
  "jobs:read": "Leer trabajos",
  "jobs:write": "Crear/actualizar trabajos",
  "milestones:read": "Leer hitos",
  "knowledge:read": "Consultar la base de conocimiento",
  "uploads:driver": "Subir archivos como driver de storage",
  "tools:invoke": "Invocar herramientas de SEMSE",
  "events:subscribe": "Suscribirse a eventos"
};

const WRITE_SCOPES = new Set<string>(["intake:write", "jobs:write", "uploads:driver", "tools:invoke"]);

function tokenTone(token: SatelliteToken): { label: string; tone: Tone } {
  if (token.status === "REVOKED" || token.revokedAt) return { label: "Revocado", tone: "muted" };
  if (token.expiresAt && new Date(token.expiresAt).getTime() < Date.now()) return { label: "Expirado", tone: "error" };
  return { label: "Activo", tone: "ok" };
}

function webhookTone(hook: SatelliteWebhook): { label: string; tone: Tone } {
  // SatelliteWebhook.status: ACTIVE | SUSPENDED (suspended after repeated delivery failures).
  if (hook.status === "SUSPENDED") return { label: "Suspendido", tone: "error" };
  if (hook.status !== "ACTIVE") return { label: hook.status, tone: "muted" };
  if (hook.consecutiveFailures > 0) return { label: `${hook.consecutiveFailures} fallo(s)`, tone: "warn" };
  return { label: "Activo", tone: "ok" };
}

export default function AdminSatellitesPage() {
  const [tokens, setTokens] = useState<SatelliteToken[]>([]);
  const [webhooks, setWebhooks] = useState<SatelliteWebhook[]>([]);
  const [webhooksError, setWebhooksError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [issued, setIssued] = useState<IssuedSatelliteToken | null>(null);
  const [showIssue, setShowIssue] = useState(false);
  const [revoking, setRevoking] = useState<{ kind: "token" | "webhook"; id: string; label: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTokens((await fetchSatelliteTokens()) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los tokens");
    }
    try {
      setWebhooks((await fetchSatelliteWebhooks()) ?? []);
      setWebhooksError(null);
    } catch (e) {
      setWebhooksError(e instanceof Error ? e.message : "No se pudieron cargar los webhooks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const active = tokens.filter((t) => tokenTone(t).tone === "ok").length;
  const failing = webhooks.filter((w) => w.consecutiveFailures > 0 || w.status !== "ACTIVE").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <AdminPageHeader
        title="Satélites"
        subtitle="Apps externas conectadas a SEMSE por SDK: credenciales con alcance mínimo y webhooks salientes firmados."
        icon={Orbit}
        iconColor="var(--signal)"
        iconBg="color-mix(in srgb, var(--signal) 14%, transparent)"
        backHref="/admin/tool-hub"
        backLabel="Tool Hub"
      />
      <div style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: 8, marginTop: -8 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <Button icon={RefreshCw} onClick={() => void load()} busy={loading}>
            Actualizar
          </Button>
          <Button variant="primary" icon={Plus} onClick={() => setShowIssue(true)}>
            Emitir token
          </Button>
        </div>
      </div>

      {error ? <Banner tone="error" onDismiss={() => setError(null)}>{error}</Banner> : null}
      {flash ? <Banner tone="ok" onDismiss={() => setFlash(null)}>{flash}</Banner> : null}

      {issued ? <IssuedTokenCard issued={issued} onDone={() => setIssued(null)} /> : null}

      <StatGrid>
        <Stat label="Satélites activos" value={active} tone={active ? "ok" : "muted"} />
        <Stat label="Tokens emitidos" value={tokens.length} />
        <Stat label="Webhooks" value={webhooks.length} tone="brand" />
        <Stat label="Webhooks con fallos" value={failing} tone={failing ? "warn" : "muted"} />
      </StatGrid>

      {showIssue ? (
        <IssueTokenPanel
          existing={new Set(tokens.filter((t) => tokenTone(t).tone === "ok").map((t) => t.name))}
          onCancel={() => setShowIssue(false)}
          onIssued={(token) => {
            setShowIssue(false);
            setIssued(token);
            void load();
          }}
        />
      ) : null}

      <Panel title="Tokens de satélite" icon={KeyRound} padded={tokens.length === 0}>
        {loading && tokens.length === 0 ? (
          <Loading />
        ) : tokens.length === 0 ? (
          <Empty
            icon={KeyRound}
            title="No hay satélites registrados"
            description="Emite un token para conectar una app externa (móvil, Alexa, integraciones) con los scopes mínimos que necesita."
          />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 680, borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em" }}>
                  {["Satélite", "Scopes", "Estado", "Último uso", "Expira", ""].map((h) => (
                    <th key={h} style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tokens.map((token) => {
                  const status = tokenTone(token);
                  return (
                    <tr key={token.id} style={{ borderBottom: "1px solid var(--border)", verticalAlign: "top" }}>
                      <td style={{ padding: "10px 16px" }}>
                        <div style={{ fontWeight: 700, color: "var(--ink)", fontFamily: "var(--font-mono)" }}>{token.name}</div>
                        <div style={{ fontSize: 11, color: "var(--faint)" }}>creado {formatDate(token.createdAt)}</div>
                      </td>
                      <td style={{ padding: "10px 16px" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, maxWidth: 360 }}>
                          {token.scopes.map((s) => (
                            <Pill key={s} tone={WRITE_SCOPES.has(s) ? "warn" : "muted"}>
                              {s}
                            </Pill>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: "10px 16px" }}>
                        <Pill tone={status.tone}>{status.label}</Pill>
                      </td>
                      <td style={{ padding: "10px 16px", color: "var(--muted)" }}>{token.lastUsedAt ? formatDate(token.lastUsedAt, true) : "Nunca"}</td>
                      <td style={{ padding: "10px 16px", color: "var(--muted)" }}>{token.expiresAt ? formatDate(token.expiresAt) : "Sin vencimiento"}</td>
                      <td style={{ padding: "10px 16px", textAlign: "right" }}>
                        {status.tone === "ok" ? (
                          <Button variant="danger" icon={Trash2} onClick={() => setRevoking({ kind: "token", id: token.id, label: token.name })}>
                            Revocar
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Webhooks salientes" icon={Webhook} padded={webhooks.length === 0 || Boolean(webhooksError)}>
        {webhooksError ? (
          <Banner tone="warn">{webhooksError}</Banner>
        ) : webhooks.length === 0 ? (
          <Empty
            icon={Webhook}
            title="Ningún satélite registró webhooks"
            description="Cada satélite registra sus propios webhooks con su token (scope events:subscribe). Desde aquí puedes auditarlos y revocarlos."
          />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", minWidth: 680, borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em" }}>
                  {["Destino", "Eventos", "Estado", "Última entrega", ""].map((h) => (
                    <th key={h} style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {webhooks.map((hook) => {
                  const status = webhookTone(hook);
                  return (
                    <tr key={hook.id} style={{ borderBottom: "1px solid var(--border)", verticalAlign: "top" }}>
                      <td style={{ padding: "10px 16px", color: "var(--ink)", fontFamily: "var(--font-mono)", fontSize: 12, wordBreak: "break-all", maxWidth: 360 }}>
                        {hook.url}
                      </td>
                      <td style={{ padding: "10px 16px" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {hook.events.map((e) => (
                            <Pill key={e} tone="brand">
                              {e}
                            </Pill>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: "10px 16px" }}>
                        <Pill tone={status.tone}>{status.label}</Pill>
                      </td>
                      <td style={{ padding: "10px 16px", color: "var(--muted)" }}>{hook.lastDeliveryAt ? formatDate(hook.lastDeliveryAt, true) : "Sin entregas"}</td>
                      <td style={{ padding: "10px 16px", textAlign: "right" }}>
                        <Button variant="danger" icon={Trash2} onClick={() => setRevoking({ kind: "webhook", id: hook.id, label: hook.url })}>
                          Eliminar
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <ConfirmDialog
        open={Boolean(revoking)}
        title={revoking?.kind === "token" ? "Revocar token de satélite" : "Eliminar webhook"}
        confirmLabel={revoking?.kind === "token" ? "Revocar" : "Eliminar"}
        tone="error"
        busy={busy}
        onCancel={() => setRevoking(null)}
        onConfirm={async () => {
          if (!revoking) return;
          setBusy(true);
          setError(null);
          try {
            if (revoking.kind === "token") await revokeSatelliteToken(revoking.id);
            else await revokeSatelliteWebhook(revoking.id);
            setFlash(revoking.kind === "token" ? `Token «${revoking.label}» revocado.` : "Webhook eliminado.");
            setRevoking(null);
            await load();
          } catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo completar la acción");
          } finally {
            setBusy(false);
          }
        }}
      >
        {revoking?.kind === "token" ? (
          <>
            La app <strong style={{ color: "var(--ink)" }}>{revoking.label}</strong> perderá el acceso a SEMSE de inmediato. Para
            reconectarla tendrás que emitir un token nuevo y configurarlo en la app.
          </>
        ) : (
          <>SEMSE dejará de enviar eventos a <strong style={{ color: "var(--ink)", wordBreak: "break-all" }}>{revoking?.label}</strong>.</>
        )}
      </ConfirmDialog>
    </div>
  );
}

function IssueTokenPanel({
  existing,
  onCancel,
  onIssued
}: {
  existing: Set<string>;
  onCancel: () => void;
  onIssued: (token: IssuedSatelliteToken) => void;
}) {
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<Set<SatelliteScope>>(new Set());
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameValid = /^[a-z0-9][a-z0-9-]*$/.test(name) && name.length >= 2 && name.length <= 60;
  const duplicate = existing.has(name);

  const toggle = (scope: SatelliteScope) =>
    setScopes((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });

  return (
    <Panel title="Emitir token de satélite" icon={KeyRound}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            const token = await issueSatelliteToken({
              name,
              scopes: [...scopes],
              ...(expiresAt ? { expiresAt: new Date(`${expiresAt}T23:59:59`).toISOString() } : {})
            });
            onIssued(token);
          } catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo emitir el token");
          } finally {
            setBusy(false);
          }
        }}
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <Field label="Nombre del satélite" hint="kebab-case, 2–60 caracteres. Ej. alexa-voice, mobile-app">
            <input
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase())}
              required
              style={{ ...inputStyle, fontFamily: "var(--font-mono)" }}
              aria-invalid={Boolean(name) && (!nameValid || duplicate)}
            />
          </Field>
          <Field label="Vencimiento (opcional)" hint="Recomendado para integraciones temporales">
            <input type="date" value={expiresAt} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setExpiresAt(e.target.value)} style={inputStyle} />
          </Field>
        </div>
        {name && !nameValid ? <p style={{ margin: 0, fontSize: 12, color: "var(--error)" }}>Usa solo minúsculas, números y guiones; debe empezar por letra o número.</p> : null}
        {duplicate ? <p style={{ margin: 0, fontSize: 12, color: "var(--error)" }}>Ya existe un token activo con ese nombre. Revócalo antes de emitir uno nuevo.</p> : null}

        <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
          <legend style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 8 }}>Scopes (principio de mínimo privilegio)</legend>
          <div style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
            {SATELLITE_SCOPES.map((scope) => {
              const checked = scopes.has(scope);
              return (
                <label
                  key={scope}
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "flex-start",
                    padding: "8px 10px",
                    borderRadius: 10,
                    cursor: "pointer",
                    border: `1px solid ${checked ? "var(--brand)" : "var(--border)"}`,
                    background: checked ? "var(--brand-dim)" : "var(--bg)"
                  }}
                >
                  <input type="checkbox" checked={checked} onChange={() => toggle(scope)} style={{ marginTop: 2 }} />
                  <span>
                    <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--ink)", fontFamily: "var(--font-mono)" }}>
                      {scope} {WRITE_SCOPES.has(scope) ? <span style={{ color: "var(--warn)" }}>· escritura</span> : null}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>{SCOPE_HELP[scope]}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {error ? <Banner tone="error">{error}</Banner> : null}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" icon={KeyRound} busy={busy} disabled={!nameValid || duplicate || scopes.size === 0}>
            Emitir token
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function IssuedTokenCard({ issued, onDone }: { issued: IssuedSatelliteToken; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Banner tone="warn">
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <strong>Token de «{issued.name}» emitido. Cópialo ahora: no se volverá a mostrar.</strong>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <code
            style={{
              flex: "1 1 280px",
              padding: "8px 10px",
              borderRadius: 8,
              background: "var(--bg)",
              border: "1px solid var(--border)",
              fontSize: 12,
              wordBreak: "break-all",
              color: "var(--ink)"
            }}
          >
            {issued.token}
          </code>
          <Button
            icon={copied ? Check : Copy}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(issued.token);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? "Copiado" : "Copiar"}
          </Button>
          <Button variant="primary" onClick={onDone}>
            Ya lo guardé
          </Button>
        </div>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          SEMSE solo conserva su hash. Configúralo en la app como <code>Authorization: Bearer {"<token>"}</code>.
        </span>
      </div>
    </Banner>
  );
}
