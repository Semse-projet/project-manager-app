import { ModuleShell } from "../../../../components/admin/module-shell";
import { getAdminModuleById } from "../../../../lib/admin/admin-navigation";

const verticals = ["Construction", "Property Turnovers", "Cleaning", "Agro / FarmOps", "Maintenance"];

export default function VerticalsHubPage() {
  const module = getAdminModuleById("verticals");

  if (!module) return null;

  return (
    <ModuleShell module={module}>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {verticals.map((vertical) => (
          <article key={vertical} className="rounded-lg border border-white/[0.08] bg-[#101527] p-4">
            <h2 className="text-sm font-semibold text-ink">{vertical}</h2>
            <p className="mt-2 text-xs leading-5 text-muted">Shell prepared for vertical workflows, dashboards, and templates.</p>
          </article>
        ))}
      </section>
    </ModuleShell>
  );
}
