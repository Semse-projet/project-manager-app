import Link from "next/link";
import type { ReactNode } from "react";
import type { AdminModule } from "../../lib/admin/admin-navigation";

export function ModuleShell({
  module,
  eyebrow = "SEMSE Admin",
  children,
}: {
  module: AdminModule;
  eyebrow?: string;
  children?: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-white/[0.08] bg-[#0d1222] p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-[0.68rem] font-semibold uppercase tracking-widest text-brand">{eyebrow}</p>
            <h1 className="mt-2 text-2xl font-semibold text-ink sm:text-3xl">{module.label}</h1>
            <p className="mt-3 text-sm leading-6 text-muted">{module.description}</p>
          </div>
          {module.metric ? (
            <div className="min-w-[180px] rounded-md border border-white/[0.08] bg-white/[0.04] p-4">
              <span className="block text-[0.68rem] font-semibold uppercase tracking-widest text-muted">
                {module.metric.label}
              </span>
              <strong className="mt-1 block text-2xl font-semibold text-ink">{module.metric.value}</strong>
            </div>
          ) : null}
        </div>
      </section>

      {children ? <div className="mt-6">{children}</div> : null}

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted">Legacy routes</h2>
          <Link href="/admin/mission-control" className="text-sm font-medium text-brand hover:text-brand-dim">
            Mission Control
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {module.children.map((child) => (
            <Link
              key={`${child.id}-${child.href}`}
              href={child.href}
              className="rounded-lg border border-white/[0.08] bg-[#101527] p-4 transition hover:border-brand/40 hover:bg-white/[0.05]"
            >
              <span className="block text-sm font-semibold text-ink">{child.label}</span>
              {child.description ? <span className="mt-1 block text-xs leading-5 text-muted">{child.description}</span> : null}
              <span className="mt-3 block text-xs font-medium text-brand">{child.href}</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
