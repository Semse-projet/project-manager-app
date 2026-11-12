"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Building2, HardHat, MapPin, Plus, RefreshCw, UserMinus, UserPlus, Users } from "lucide-react";
import {
  SurfaceApiError,
  addCrewMember,
  archiveCrew,
  createCrew,
  createWorksite,
  fetchMyOrganizations,
  fetchOrgCrews,
  fetchOrgMembers,
  fetchWorksites,
  removeCrewMember,
  type Crew,
  type OrgMember,
  type OrgSummary,
  type Worksite
} from "../../app/lib/module-surfaces-api";
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
  shortId
} from "../module-surface/ui";

/**
 * Company-side management of worksites and crews (BO-07).
 * Spec: docs/specs/core/crews-worksites.spec.md (APPROVED 2026-11-12).
 *
 * The API decides everything: org:crews:manage + ACTIVE membership (403/404),
 * supervisor and members must be ACTIVE WORKERs of the org (422), and the
 * whole feature sits behind SEMSE_CREWS_ENABLED (404 when off).
 *
 * Known API gap: `GET /v1/organizations/:orgId/crews` does not return the
 * members of each crew (only the crew's supervisor can read its roster), so
 * this screen can add/remove people but cannot list current members.
 */

type Gate = "ok" | "disabled" | "forbidden" | "no-org";

function memberLabel(member: OrgMember | undefined, userId: string) {
  return member ? `${shortId(userId, 14)} · desde ${formatDate(member.createdAt)}` : shortId(userId, 14);
}

export function CrewsWorkspace() {
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [orgId, setOrgId] = useState<string>("");
  const [gate, setGate] = useState<Gate>("ok");
  const [worksites, setWorksites] = useState<Worksite[]>([]);
  const [crews, setCrews] = useState<Crew[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [archiving, setArchiving] = useState<Crew | null>(null);

  useEffect(() => {
    fetchMyOrganizations()
      .then((list) => {
        const rows = (list ?? []).filter((o) => typeof o.id === "string");
        setOrgs(rows);
        if (rows[0]) setOrgId(rows[0].id);
        else {
          setGate("no-org");
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : "No se pudieron cargar tus empresas");
        setLoading(false);
      });
  }, []);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const [sites, list] = await Promise.all([fetchWorksites(orgId), fetchOrgCrews(orgId)]);
      setWorksites(sites ?? []);
      setCrews(list ?? []);
      setGate("ok");
      // Members feed the pickers; a failure here should not hide the crews.
      setMembers((await fetchOrgMembers(orgId).catch(() => [] as OrgMember[])) ?? []);
    } catch (e) {
      if (e instanceof SurfaceApiError && e.status === 404) setGate("disabled");
      else if (e instanceof SurfaceApiError && e.status === 403) setGate("forbidden");
      else setError(e instanceof Error ? e.message : "No se pudieron cargar las cuadrillas");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(key: string, task: () => Promise<void>) {
    setBusy(key);
    setError(null);
    setFlash(null);
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : "La acción falló");
    } finally {
      setBusy(null);
    }
  }

  const memberById = useMemo(() => new Map(members.map((m) => [m.userId, m])), [members]);
  const siteById = useMemo(() => new Map(worksites.map((w) => [w.worksiteId, w])), [worksites]);

  const crewsBySite = useMemo(() => {
    const groups = new Map<string, Crew[]>();
    crews.forEach((c) => {
      const key = c.worksiteId ?? "";
      groups.set(key, [...(groups.get(key) ?? []), c]);
    });
    return [...groups.entries()].sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : 0));
  }, [crews]);

  const header = (
    <Panel
      title="Empresa"
      icon={Building2}
      actions={
        <Button icon={RefreshCw} onClick={() => void load()} busy={loading} disabled={!orgId}>
          Actualizar
        </Button>
      }
    >
      {orgs.length > 1 ? (
        <Field label="Gestionar cuadrillas de">
          <select value={orgId} onChange={(e) => setOrgId(e.target.value)} style={inputStyle}>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name ?? o.id}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <p style={{ margin: 0, fontSize: 14, color: "var(--ink)", fontWeight: 600 }}>
          {orgs[0]?.name ?? (orgId || "—")}
        </p>
      )}
    </Panel>
  );

  if (gate === "no-org") {
    return (
      <Panel>
        <Empty icon={Building2} title="No perteneces a ninguna empresa" description="Las cuadrillas se gestionan desde la cuenta de una empresa (cliente o contratista)." />
      </Panel>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {header}
      {error ? <Banner tone="error" onDismiss={() => setError(null)}>{error}</Banner> : null}
      {flash ? <Banner tone="ok" onDismiss={() => setFlash(null)}>{flash}</Banner> : null}

      {loading && crews.length === 0 && worksites.length === 0 ? (
        <Loading label="Cargando obras y cuadrillas…" />
      ) : gate === "disabled" ? (
        <Panel>
          <Empty
            icon={HardHat}
            title="Las cuadrillas aún no están habilitadas para tu empresa"
            description="La función está lista pero apagada. Cuando operaciones la active, aquí podrás crear obras, formar cuadrillas y asignar supervisores."
          />
        </Panel>
      ) : gate === "forbidden" ? (
        <Panel>
          <Empty
            icon={HardHat}
            title="Tu rol no puede gestionar cuadrillas"
            description="Solo el dueño o un representante de la empresa puede crear obras y cuadrillas. Si eres supervisor, revisa tu cuadrilla en «Mi cuadrilla»."
          />
        </Panel>
      ) : (
        <>
          <StatGrid>
            <Stat label="Obras activas" value={worksites.length} />
            <Stat label="Cuadrillas activas" value={crews.length} tone="brand" />
            <Stat label="Personas en la empresa" value={members.length} hint="Membresías activas" />
            <Stat label="Sin obra asignada" value={crews.filter((c) => !c.worksiteId).length} tone={crews.some((c) => !c.worksiteId) ? "warn" : "muted"} />
          </StatGrid>

          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))" }}>
            <WorksitesPanel
              worksites={worksites}
              busy={busy === "site"}
              onCreate={(input) =>
                run("site", async () => {
                  await createWorksite(orgId, input);
                  setFlash(`Obra «${input.name}» creada.`);
                  await load();
                })
              }
            />
            <CreateCrewPanel
              worksites={worksites}
              members={members}
              busy={busy === "crew"}
              onCreate={(input) =>
                run("crew", async () => {
                  await createCrew(orgId, input);
                  setFlash(`Cuadrilla «${input.name}» creada.`);
                  await load();
                })
              }
            />
          </div>

          <Panel title="Cuadrillas" icon={Users}>
            {crews.length === 0 ? (
              <Empty icon={Users} title="Todavía no hay cuadrillas" description="Crea una obra y luego una cuadrilla con su supervisor para empezar a asignar trabajo en campo." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {crewsBySite.map(([siteId, group]) => {
                  const site = siteId ? siteById.get(siteId) : undefined;
                  return (
                    <section key={siteId || "none"}>
                      <h3 style={{ display: "flex", alignItems: "center", gap: 6, margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "var(--muted)" }}>
                        <MapPin size={13} aria-hidden />
                        {site ? site.name : siteId ? `Obra ${shortId(siteId)}` : "Sin obra asignada"}
                        {site?.address ? <span style={{ fontWeight: 500, color: "var(--faint)" }}>· {site.address}</span> : null}
                      </h3>
                      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))" }}>
                        {group.map((crew) => (
                          <CrewCard
                            key={crew.crewId}
                            crew={crew}
                            supervisorLabel={memberLabel(memberById.get(crew.supervisorUserId), crew.supervisorUserId)}
                            members={members}
                            busy={busy}
                            onAdd={(userId) =>
                              run(`add:${crew.crewId}`, async () => {
                                await addCrewMember(orgId, crew.crewId, userId);
                                setFlash(`${shortId(userId, 14)} agregado a «${crew.name}».`);
                              })
                            }
                            onRemove={(userId) =>
                              run(`remove:${crew.crewId}`, async () => {
                                await removeCrewMember(orgId, crew.crewId, userId);
                                setFlash(`${shortId(userId, 14)} quitado de «${crew.name}».`);
                              })
                            }
                            onArchive={() => setArchiving(crew)}
                          />
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </Panel>
        </>
      )}

      <ConfirmDialog
        open={Boolean(archiving)}
        title="Archivar cuadrilla"
        confirmLabel="Archivar"
        tone="error"
        busy={busy === "archive"}
        onCancel={() => setArchiving(null)}
        onConfirm={() =>
          archiving &&
          void run("archive", async () => {
            await archiveCrew(orgId, archiving.crewId);
            setFlash(`Cuadrilla «${archiving.name}» archivada.`);
            setArchiving(null);
            await load();
          })
        }
      >
        «{archiving?.name}» dejará de aparecer para su supervisor y sus miembros, y no se le podrán asignar tareas nuevas. El archivo es
        definitivo: para volver a trabajar con ese equipo tendrás que crear una cuadrilla nueva.
      </ConfirmDialog>
    </div>
  );
}

function WorksitesPanel({
  worksites,
  busy,
  onCreate
}: {
  worksites: Worksite[];
  busy: boolean;
  onCreate: (input: { name: string; address?: string }) => void;
}) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  return (
    <Panel title="Obras" icon={MapPin}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onCreate({ name: name.trim(), ...(address.trim() ? { address: address.trim() } : {}) });
          setName("");
          setAddress("");
        }}
        style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", alignItems: "end" }}
      >
        <Field label="Nombre de la obra">
          <input value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={120} required style={inputStyle} placeholder="Ej. Torre Norte" />
        </Field>
        <Field label="Dirección (opcional)">
          <input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} style={inputStyle} />
        </Field>
        <Button type="submit" variant="primary" icon={Plus} busy={busy} disabled={name.trim().length < 2}>
          Crear obra
        </Button>
      </form>
      <ul style={{ listStyle: "none", margin: "14px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        {worksites.length === 0 ? (
          <li style={{ fontSize: 13, color: "var(--muted)" }}>Aún no hay obras.</li>
        ) : (
          worksites.map((w) => (
            <li key={w.worksiteId} style={{ display: "flex", gap: 8, alignItems: "baseline", fontSize: 13 }}>
              <MapPin size={12} style={{ color: "var(--faint)", flexShrink: 0 }} aria-hidden />
              <span style={{ color: "var(--ink)", fontWeight: 600 }}>{w.name}</span>
              {w.address ? <span style={{ color: "var(--muted)" }}>{w.address}</span> : null}
            </li>
          ))
        )}
      </ul>
    </Panel>
  );
}

function CreateCrewPanel({
  worksites,
  members,
  busy,
  onCreate
}: {
  worksites: Worksite[];
  members: OrgMember[];
  busy: boolean;
  onCreate: (input: { name: string; supervisorUserId: string; worksiteId?: string }) => void;
}) {
  const [name, setName] = useState("");
  const [supervisor, setSupervisor] = useState("");
  const [site, setSite] = useState("");
  return (
    <Panel title="Nueva cuadrilla" icon={HardHat}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onCreate({ name: name.trim(), supervisorUserId: supervisor, ...(site ? { worksiteId: site } : {}) });
          setName("");
        }}
        style={{ display: "flex", flexDirection: "column", gap: 10 }}
      >
        <Field label="Nombre">
          <input value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={120} required style={inputStyle} placeholder="Ej. Cuadrilla de acabados" />
        </Field>
        <Field label="Supervisor" hint="Debe ser un trabajador (WORKER) activo de la empresa; la plataforma lo valida.">
          <select value={supervisor} onChange={(e) => setSupervisor(e.target.value)} required style={inputStyle}>
            <option value="">Selecciona una persona…</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {memberLabel(m, m.userId)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Obra (opcional)">
          <select value={site} onChange={(e) => setSite(e.target.value)} style={inputStyle}>
            <option value="">Sin obra por ahora</option>
            {worksites.map((w) => (
              <option key={w.worksiteId} value={w.worksiteId}>
                {w.name}
              </option>
            ))}
          </select>
        </Field>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button type="submit" variant="primary" icon={Plus} busy={busy} disabled={name.trim().length < 2 || !supervisor}>
            Crear cuadrilla
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function CrewCard({
  crew,
  supervisorLabel,
  members,
  busy,
  onAdd,
  onRemove,
  onArchive
}: {
  crew: Crew;
  supervisorLabel: string;
  members: OrgMember[];
  busy: string | null;
  onAdd: (userId: string) => void;
  onRemove: (userId: string) => void;
  onArchive: () => void;
}) {
  const [person, setPerson] = useState("");
  const candidates = members.filter((m) => m.userId !== crew.supervisorUserId);
  return (
    <article style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 14, background: "var(--bg)", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <strong style={{ flex: 1, fontSize: 15, color: "var(--ink)" }}>{crew.name}</strong>
        <Pill tone="ok">Activa</Pill>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 13, color: "var(--muted)" }}>
        <HardHat size={12} style={{ flexShrink: 0 }} aria-hidden />
        <span>Supervisor:</span>
        <span style={{ color: "var(--ink)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{supervisorLabel}</span>
      </div>
      <Field label="Persona">
        <select value={person} onChange={(e) => setPerson(e.target.value)} style={inputStyle} aria-label={`Persona para ${crew.name}`}>
          <option value="">Selecciona…</option>
          {candidates.map((m) => (
            <option key={m.userId} value={m.userId}>
              {memberLabel(m, m.userId)}
            </option>
          ))}
        </select>
      </Field>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Button icon={UserPlus} busy={busy === `add:${crew.crewId}`} disabled={!person} onClick={() => onAdd(person)}>
          Agregar
        </Button>
        <Button variant="ghost" icon={UserMinus} busy={busy === `remove:${crew.crewId}`} disabled={!person} onClick={() => onRemove(person)}>
          Quitar
        </Button>
        <span style={{ flex: 1 }} />
        <Button variant="danger" icon={Archive} onClick={onArchive}>
          Archivar
        </Button>
      </div>
      <p style={{ margin: 0, fontSize: 11, color: "var(--faint)" }}>
        Agregar es idempotente. Por ahora la lista de miembros solo la ve el supervisor de la cuadrilla.
      </p>
    </article>
  );
}
