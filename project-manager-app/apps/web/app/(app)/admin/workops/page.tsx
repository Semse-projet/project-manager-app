import { ModuleShell } from "../../../../components/admin/module-shell";
import { getAdminModuleById } from "../../../../lib/admin/admin-navigation";

export default function WorkOpsHubPage() {
  const module = getAdminModuleById("workops");

  if (!module) return null;

  return (
    <ModuleShell module={module}>
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-white/[0.08] bg-[#101527] p-5">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">Flow</h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            Capture work, assign crews, track milestones, collect evidence, approve change orders, and close QA.
          </p>
        </div>
        <div className="rounded-lg border border-white/[0.08] bg-[#101527] p-5">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">Primary operators</h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            Field teams, contractors, PMO, QA reviewers, and operations coordinators.
          </p>
        </div>
        <div className="rounded-lg border border-white/[0.08] bg-[#101527] p-5">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">Safe phase</h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            This hub links existing Admin routes without moving legacy pages or touching backend contracts.
          </p>
        </div>
      </section>
    </ModuleShell>
  );
}
