import { ModuleShell } from "../../../../components/admin/module-shell";
import { getAdminModuleById } from "../../../../lib/admin/admin-navigation";

export default function IntelligenceHubPage() {
  const module = getAdminModuleById("intelligence");

  if (!module) return null;

  return (
    <ModuleShell module={module}>
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-white/[0.08] bg-[#101527] p-5">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">AI operations</h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            Central access for agents, Prometeo, autonomy, model metrics, memory, and intelligence rooms.
          </p>
        </div>
        <div className="rounded-lg border border-white/[0.08] bg-[#101527] p-5">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">Decision support</h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            Keep diagnosis, recommendations, simulations, and operational signals grouped in one hub.
          </p>
        </div>
        <div className="rounded-lg border border-white/[0.08] bg-[#101527] p-5">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">Safe phase</h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            Existing intelligence pages remain in place while the modular entry point is introduced.
          </p>
        </div>
      </section>
    </ModuleShell>
  );
}
